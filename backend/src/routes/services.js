const express = require('express');
const path = require('path');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { resequenceProjectsForService } = require('../utils/projectTaskOrder');
const multer = require('multer');
const XLSX = require('xlsx');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const BULK_COLUMNS = {
    STEP: 'Step',
    TASK_DESCRIPTION: 'Task/Description',
    STANDARD_REFERENCE_NAME: 'Standard for Reference Name(optional)',
    REFERENCE_LINK: 'Reference Link(optional)',
};

function isValidHttpUrl(value) {
    if (!value) return true;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (err) {
        return false;
    }
}

function normalizeDocValue(value) {
    return String(value ?? '').trim();
}

function normalizeServiceUploadRows(rows) {
    const normalized = [];
    let currentStepName = '';
    let currentStepHasTask = false;

    rows.forEach((rawRow, index) => {
        const rowNumber = index + 2;
        const stepRaw = String(rawRow[BULK_COLUMNS.STEP] ?? '').trim();
        const taskDescription = String(rawRow[BULK_COLUMNS.TASK_DESCRIPTION] ?? '').trim();
        const standardReferenceName = String(rawRow[BULK_COLUMNS.STANDARD_REFERENCE_NAME] ?? '').trim();
        const referenceLink = String(rawRow[BULK_COLUMNS.REFERENCE_LINK] ?? '').trim();

        const isCompletelyEmpty = !stepRaw && !taskDescription && !standardReferenceName && !referenceLink;
        if (isCompletelyEmpty) return;

        const errors = [];
        const hasReferenceName = !!standardReferenceName;
        const hasReferenceLink = !!referenceLink;
        const hasAnyReferenceValue = hasReferenceName || hasReferenceLink;

        if (stepRaw) {
            currentStepName = stepRaw;
            currentStepHasTask = false;
        } else if (!currentStepName) {
            errors.push('Step is required on the first row of each step block');
        }

        if (!hasReferenceName && hasReferenceLink) {
            errors.push('Standard for Reference Name is required when Reference Link is provided');
        }
        if (hasReferenceLink && !isValidHttpUrl(referenceLink)) {
            errors.push('Reference Link must start with http:// or https://');
        }

        if (!taskDescription) {
            if (hasAnyReferenceValue && !currentStepHasTask) {
                errors.push('Reference-only row requires a previous task in the same step');
            }
            if (!hasAnyReferenceValue) {
                errors.push('Task/Description is required');
            }
        } else {
            currentStepHasTask = true;
        }

        normalized.push({
            id: Date.now() + index,
            row_number: rowNumber,
            step: stepRaw,
            step_name: currentStepName || '',
            task_description: taskDescription,
            standard_reference_name: standardReferenceName,
            reference_link: referenceLink,
            is_step_start: !!stepRaw,
            is_reference_only: !taskDescription && hasAnyReferenceValue,
            errors,
        });
    });

    return normalized;
}

// ==========================================
// SERVICES CRUD
// ==========================================

// GET /api/services
router.get('/', authenticate, async (req, res) => {
    try {
        const services = await db('services').where({ is_active: true }).orderBy('name');
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

// GET /api/services/:id (Deep fetch of Steps, Tasks, and Documents)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const service = await db('services').where({ id: req.params.id }).first();
        if (!service) return res.status(404).json({ error: 'Service not found.' });

        // Fetch Steps
        const steps = await db('service_steps')
            .where({ service_id: service.id, is_active: true })
            .orderBy('sequence_order')
            .orderBy('id');

        // Fetch Tasks for each Step
        for (let step of steps) {
            step.tasks = await db('service_tasks')
                .where({ service_step_id: step.id, is_active: true })
                .orderBy('sequence_order')
                .orderBy('id');
            
            // Fetch Shared Documents for each Task
            for (let task of step.tasks) {
                const docs = await db('reference_documents')
                    .join('service_task_documents', 'reference_documents.id', 'service_task_documents.document_id')
                    .where('service_task_documents.service_task_id', task.id)
                    .select('reference_documents.*');
                task.documents = docs;
            }
        }

        res.json({ ...service, steps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch service details.' });
    }
});

// GET /api/services/bulk/upload-steps/sample-excel
router.get('/bulk/upload-steps/sample-excel', authenticate, (req, res) => {
    const filePath = path.join(__dirname, '../assets/samples/sample_service.xlsx');
    res.download(filePath, 'sample_service.xlsx', (err) => {
        if (err) {
            console.error('Error downloading sample excel:', err);
            res.status(500).json({ error: 'Failed to download sample file.' });
        }
    });
});


// POST /api/services/:id/upload-steps/validate
router.post('/:id/upload-steps/validate', authenticate, authorize('services', 'can_edit'), upload.single('file'), async (req, res) => {
    try {
        const service = await db('services').where({ id: req.params.id }).first();
        if (!service) return res.status(404).json({ error: 'Service not found.' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsedRows = normalizeServiceUploadRows(rows);

        if (parsedRows.length === 0) {
            return res.status(400).json({ error: 'Excel has no usable rows. Please add data rows.' });
        }

        res.json({ rows: parsedRows });
    } catch (err) {
        console.error('Upload steps validate error:', err);
        res.status(500).json({ error: `Failed to validate file: ${err.message}` });
    }
});

// POST /api/services/:id/upload-steps/confirm
router.post('/:id/upload-steps/confirm', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const serviceId = req.params.id;
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'No rows provided.' });
        }

        const normalized = normalizeServiceUploadRows(rows.map((r) => ({
            [BULK_COLUMNS.STEP]: r.step,
            [BULK_COLUMNS.TASK_DESCRIPTION]: r.task_description,
            [BULK_COLUMNS.STANDARD_REFERENCE_NAME]: r.standard_reference_name,
            [BULK_COLUMNS.REFERENCE_LINK]: r.reference_link,
        })));

        if (normalized.length === 0) {
            return res.status(400).json({ error: 'No usable rows after validation.' });
        }

        const invalidRows = normalized.filter((r) => r.errors.length > 0);
        if (invalidRows.length > 0) {
            return res.status(400).json({ error: 'Some rows are invalid. Please fix errors in preview first.', rows: normalized });
        }

        // Build step/task model by row sequence; a new step starts when Step cell is filled.
        const orderedSteps = [];
        let currentStep = null;
        normalized.forEach((row) => {
            if (row.is_step_start || !currentStep) {
                currentStep = { step_name: row.step_name || '', tasks: [] };
                orderedSteps.push(currentStep);
            }
            currentStep.tasks.push(row);
        });

        await db.transaction(async (trx) => {
            const activeProjects = await trx('projects')
                .where({ service_id: serviceId, is_active: true })
                .whereIn('status', ['not_started', 'in_progress', 'on_hold'])
                .select('id', 'start_date');

            const existingStepIds = (await trx('service_steps').where({ service_id: serviceId }).select('id')).map((x) => x.id);
            const existingTaskIds = existingStepIds.length > 0
                ? (await trx('service_tasks').whereIn('service_step_id', existingStepIds).select('id')).map((x) => x.id)
                : [];

            if (existingTaskIds.length > 0) {
                await trx('service_task_documents').whereIn('service_task_id', existingTaskIds).del();
            }
            if (existingStepIds.length > 0) {
                await trx('service_steps').whereIn('id', existingStepIds).del();
            }

            const newTemplateTasks = [];

            for (let stepIdx = 0; stepIdx < orderedSteps.length; stepIdx += 1) {
                const step = orderedSteps[stepIdx];
                const [newStep] = await trx('service_steps')
                    .insert({
                        service_id: serviceId,
                        name: step.step_name || null,
                        description: null,
                        sequence_order: stepIdx,
                    })
                    .returning('*');

                const taskItems = [];
                let currentTaskItem = null;

                for (let rowIdx = 0; rowIdx < step.tasks.length; rowIdx += 1) {
                    const row = step.tasks[rowIdx];
                    if (row.task_description) {
                        currentTaskItem = {
                            task_description: row.task_description,
                            references: [],
                        };
                        taskItems.push(currentTaskItem);
                    } else if (!currentTaskItem) {
                        throw new Error(`Row ${row.row_number}: reference row has no previous task in step "${step.step_name || 'Unnamed Step'}"`);
                    }

                    if (row.standard_reference_name) {
                        currentTaskItem.references.push({
                            name: row.standard_reference_name,
                            link: row.reference_link || null,
                        });
                    }
                }

                for (let taskIdx = 0; taskIdx < taskItems.length; taskIdx += 1) {
                    const task = taskItems[taskIdx];
                    const [newTask] = await trx('service_tasks')
                        .insert({
                            service_step_id: newStep.id,
                            name: task.task_description,
                            description: null,
                            default_duration_days: null,
                            sequence_order: taskIdx,
                            is_mandatory: true,
                        })
                        .returning('*');

                    newTemplateTasks.push({
                        service_task_id: newTask.id,
                        step_name: newStep.name || '',
                        name: newTask.name,
                        description: newTask.description,
                        default_duration_days: newTask.default_duration_days,
                        sequence_order: taskIdx
                    });

                    for (let refIdx = 0; refIdx < task.references.length; refIdx += 1) {
                        const ref = task.references[refIdx];
                        let doc = await trx('reference_documents')
                            .where({ service_id: serviceId })
                            .andWhereRaw('LOWER(name) = LOWER(?)', [ref.name])
                            .andWhereRaw('LOWER(COALESCE(file_url, \'\')) = LOWER(?)', [ref.link || ''])
                            .first();

                        if (!doc) {
                            [doc] = await trx('reference_documents')
                                .insert({
                                    service_id: serviceId,
                                    name: ref.name,
                                    file_url: ref.link,
                                    description: null,
                                })
                                .returning('*');
                        }

                        await trx('service_task_documents')
                            .insert({ service_task_id: newTask.id, document_id: doc.id })
                            .onConflict(['service_task_id', 'document_id'])
                            .ignore();
                    }
                }
            }

            if (activeProjects.length > 0) {
                for (const p of activeProjects) {
                    const existingPTs = await trx('project_tasks').where({ project_id: p.id });
                    
                    for (const nt of newTemplateTasks) {
                        const match = existingPTs.find(pt => pt.name === nt.name && pt.step_name === nt.step_name && !pt._handled);
                        
                        if (match) {
                            await trx('project_tasks').where({ id: match.id }).update({
                                service_task_id: nt.service_task_id,
                                description: nt.description || match.description,
                                sequence_order: nt.sequence_order
                            });
                            match._handled = true;
                        } else {
                            let taskStart = null, taskDue = null;
                            if (p.start_date && nt.default_duration_days) {
                                taskStart = p.start_date;
                                const due = new Date(p.start_date);
                                due.setDate(due.getDate() + nt.default_duration_days);
                                taskDue = due.toISOString().split('T')[0];
                            }
                            await trx('project_tasks').insert({
                                project_id: p.id,
                                service_task_id: nt.service_task_id,
                                step_name: nt.step_name,
                                name: nt.name,
                                description: nt.description,
                                sequence_order: nt.sequence_order,
                                is_mandatory: true,
                                start_date: taskStart,
                                due_date: taskDue
                            });
                        }
                    }

                    const toDelete = existingPTs.filter(pt => !pt._handled);
                    if (toDelete.length > 0) {
                        await trx('project_tasks').whereIn('id', toDelete.map(pt => pt.id)).del();
                    }
                }
            }
        });

        await resequenceProjectsForService(db, serviceId);

        res.json({ message: 'Service steps replaced successfully.' });
    } catch (err) {
        console.error('Upload steps confirm error:', err);
        res.status(500).json({ error: `Failed to apply upload: ${err.message}` });
    }
});

// POST /api/services
router.post('/', authenticate, authorize('services', 'can_edit'), authorize('services', 'can_create'), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        if (!name || !code) return res.status(400).json({ error: 'Name and Code are required.' });
        
        const [service] = await db('services').insert({ name, code, description }).returning('*');
        res.status(201).json(service);
    } catch (err) {
        if (err.code === '23505') {
            if (err.detail && err.detail.includes('code')) {
                return res.status(400).json({ error: 'Service code already in use, please change the service code.' });
            }
            return res.status(400).json({ error: 'Service name already in use, please change the name.' });
        }
        res.status(500).json({ error: 'Failed to create service.' });
    }
});

// PUT /api/services/:id
router.put('/:id', authenticate, authorize('services', 'can_edit'), authorize('services', 'can_edit'), async (req, res) => {
    try {
        const { name, code, description, is_active } = req.body;
        if (!name || !code) return res.status(400).json({ error: 'Name and Code are required.' });
        
        const [service] = await db('services').where({ id: req.params.id }).update({ name, code, description, is_active, updated_at: db.fn.now() }).returning('*');
        res.json(service);
    } catch (err) {
        if (err.code === '23505') {
            if (err.detail && err.detail.includes('code')) {
                return res.status(400).json({ error: 'Service code already in use, please change the service code.' });
            }
            return res.status(400).json({ error: 'Service name already in use, please change the name.' });
        }
        res.status(500).json({ error: 'Failed to update service.' });
    }
});

// DELETE /api/services/:id (Hard delete with Deep Sync)
router.delete('/:id', authenticate, authorize('services', 'can_edit'), authorize('services', 'can_delete'), async (req, res) => {
    try {
        // Deep Sync: Cascade delete all active projects relying on this service first
        // (This naturally cleans up project_tasks and project references via DB cascade constraints)
        await db('projects').where({ service_id: req.params.id }).delete();

        // Finally, delete the service template itself
        await db('services').where({ id: req.params.id }).delete();
        res.json({ message: 'Service and all synchronized projects successfully deleted.' });
    } catch (err) {
        console.error("Service Delete Error:", err);
        res.status(500).json({ error: 'Failed to delete service.' });
    }
});

// ==========================================
// STEPS CRUD
// ==========================================

// POST /api/services/:id/steps
router.post('/:id/steps', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const { name, description } = req.body;
        let { sequence_order } = req.body;

        if (sequence_order === undefined || sequence_order === null) {
            const lastStep = await db('service_steps')
                .where({ service_id: req.params.id })
                .orderBy('sequence_order', 'desc')
                .first();
            sequence_order = lastStep ? lastStep.sequence_order + 1 : 0;
        }

        const [step] = await db('service_steps').insert({
            service_id: req.params.id,
            name,
            description,
            sequence_order
        }).returning('*');
        res.status(201).json(step);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create step.' });
    }
});

// PUT /api/services/steps/:stepId
router.put('/steps/:stepId', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const { name, description, sequence_order } = req.body;
        const updateData = { name, description, updated_at: db.fn.now() };
        if (sequence_order !== undefined) updateData.sequence_order = sequence_order;

        const [step] = await db('service_steps').where({ id: req.params.stepId }).update(updateData).returning('*');
        if (!step) return res.status(404).json({ error: 'Step not found.' });
        
        // Deep Sync: Update step_name on all project_tasks across active projects
        if (name !== undefined) {
             const templateTasks = await db('service_tasks').where({ service_step_id: step.id }).select('id');
             const taskIds = templateTasks.map(t => t.id);
             if (taskIds.length > 0) {
                 await db('project_tasks')
                     .whereIn('service_task_id', taskIds)
                     .update({ step_name: name });
             }
        }

        if (sequence_order !== undefined) {
            await resequenceProjectsForService(db, step.service_id);
        }

        res.json(step);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update step.' });
    }
});

// DELETE /api/services/steps/:stepId
router.delete('/steps/:stepId', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const step = await db('service_steps').where({ id: req.params.stepId }).first();
        if (!step) return res.status(404).json({ error: 'Step not found.' });

        // Deep Sync: Delete project tasks currently linked to this step
        const templateTasks = await db('service_tasks').where({ service_step_id: step.id }).select('id');
        const taskIds = templateTasks.map(t => t.id);
        if (taskIds.length > 0) {
            await db('project_tasks').whereIn('service_task_id', taskIds).delete();
        }

        await db('service_steps').where({ id: req.params.stepId }).delete();

        // Cascade reorder remaining steps
        await db('service_steps')
            .where({ service_id: step.service_id })
            .andWhere('sequence_order', '>', step.sequence_order)
            .decrement('sequence_order', 1);

        await resequenceProjectsForService(db, step.service_id);

        res.json({ message: 'Step deleted and remaining steps reordered.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete step.' });
    }
});

// ==========================================
// TASKS CRUD
// ==========================================

// POST /api/services/steps/:stepId/tasks
router.post('/steps/:stepId/tasks', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const { name, description } = req.body;
        let { sequence_order, default_duration_days } = req.body;
        if (!name) return res.status(400).json({ error: 'Task name is required.' });

        // allow clearing duration
        if (default_duration_days === '') default_duration_days = null;

        if (sequence_order === undefined || sequence_order === null) {
            const lastTask = await db('service_tasks')
                .where({ service_step_id: req.params.stepId })
                .orderBy('sequence_order', 'desc')
                .first();
            sequence_order = lastTask ? lastTask.sequence_order + 1 : 0;
        }

        const [task] = await db('service_tasks').insert({
            service_step_id: req.params.stepId,
            name, description, default_duration_days, sequence_order
        }).returning('*');

        // Deep Sync: Add this new task to all active projects relying on this service
        const step = await db('service_steps').where({ id: req.params.stepId }).first();
        if (step) {
            const projects = await db('projects').where({ service_id: step.service_id, is_active: true }).select('id', 'start_date');
            if (projects.length > 0) {
                const projectTasksToInsert = projects.map(p => {
                    let taskStart = null;
                    let taskDue = null;
                    if (p.start_date && task.default_duration_days) {
                        taskStart = p.start_date;
                        const due = new Date(p.start_date);
                        due.setDate(due.getDate() + task.default_duration_days);
                        taskDue = due.toISOString().split('T')[0];
                    }
                    return {
                        project_id: p.id,
                        service_task_id: task.id,
                        step_name: step.name,
                        name: task.name,
                        description: task.description,
                        sequence_order: task.sequence_order + 1,
                        is_mandatory: true,
                        start_date: taskStart,
                        due_date: taskDue
                    };
                });
                await db('project_tasks').insert(projectTasksToInsert);
                await resequenceProjectsForService(db, step.service_id);
            }
        }

        res.status(201).json(task);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create task.' });
    }
});

// PUT /api/services/tasks/:taskId
router.put('/tasks/:taskId', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const { name, description, sequence_order } = req.body;
        let { default_duration_days } = req.body;
        if (!name) return res.status(400).json({ error: 'Task name is required.' });

        // allow clearing duration
        if (default_duration_days === '') default_duration_days = null;

        const updateData = { name, description, default_duration_days, updated_at: db.fn.now() };
        if (sequence_order !== undefined) updateData.sequence_order = sequence_order;

        const [task] = await db('service_tasks').where({ id: req.params.taskId }).update(updateData).returning('*');
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        // Deep Sync: Sync task changes down to cloned project_tasks
        const projectTaskUpdate = { name: task.name, description: task.description, updated_at: db.fn.now() };
        if (sequence_order !== undefined) projectTaskUpdate.sequence_order = task.sequence_order;
        
        await db('project_tasks').where({ service_task_id: task.id }).update(projectTaskUpdate);

        const step = await db('service_steps').where({ id: task.service_step_id }).first();
        if (step && sequence_order !== undefined) {
            await resequenceProjectsForService(db, step.service_id);
        }

        res.json(task);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

// DELETE /api/services/tasks/:taskId
router.delete('/tasks/:taskId', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const task = await db('service_tasks').where({ id: req.params.taskId }).first();
        if (!task) return res.status(404).json({ error: 'Task not found.' });

        // Deep Sync: Delete all instances of this task across active projects
        await db('project_tasks').where({ service_task_id: task.id }).delete();

        await db('service_tasks').where({ id: req.params.taskId }).delete();

        // Cascade reorder remaining tasks
        await db('service_tasks')
            .where({ service_step_id: task.service_step_id })
            .andWhere('sequence_order', '>', task.sequence_order)
            .decrement('sequence_order', 1);

        const step = await db('service_steps').where({ id: task.service_step_id }).first();
        if (step) {
            await resequenceProjectsForService(db, step.service_id);
        }

        res.json({ message: 'Task deleted and remaining tasks reordered.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete task.' });
    }
});

// ==========================================
// REFERENCE DOCUMENTS (Shared)
// ==========================================

// GET /api/services/reference_documents/all
router.get('/reference_documents/all', authenticate, async (req, res) => {
    try {
        const { service_id } = req.query;
        let query = db('reference_documents');
        if (service_id) {
            query = query.where({ service_id });
        }
        const docs = await query.orderBy('name');
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch documents.' });
    }
});

// POST /api/services/reference_documents
router.post('/reference_documents', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const name = normalizeDocValue(req.body.name);
        const file_url = normalizeDocValue(req.body.file_url);
        const description = req.body.description ?? null;
        const service_id = req.body.service_id;
        const fileUrlOrNull = file_url || null;

        if (!name || !service_id) {
            return res.status(400).json({ error: 'Name and service_id are required.' });
        }
        if (file_url && !isValidHttpUrl(file_url)) {
            return res.status(400).json({ error: 'File URL must start with http:// or https://.' });
        }

        const duplicate = await db('reference_documents')
            .where({ service_id })
            .andWhereRaw('LOWER(name) = LOWER(?)', [name])
            .andWhereRaw('LOWER(COALESCE(file_url, \'\')) = LOWER(?)', [file_url || ''])
            .first();
        if (duplicate) {
            return res.status(409).json({ error: 'A reference document with the same name and URL already exists for this service.' });
        }

        const [doc] = await db('reference_documents').insert({ name, file_url: fileUrlOrNull, description, service_id }).returning('*');
        res.status(201).json(doc);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create reference document.' });
    }
});

// PUT /api/services/reference_documents/:id
router.put('/reference_documents/:id', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const name = normalizeDocValue(req.body.name);
        const file_url = normalizeDocValue(req.body.file_url);
        const description = req.body.description ?? null;
        const fileUrlOrNull = file_url || null;
        if (!name) return res.status(400).json({ error: 'Name is required.' });
        if (file_url && !isValidHttpUrl(file_url)) {
            return res.status(400).json({ error: 'File URL must start with http:// or https://.' });
        }

        const current = await db('reference_documents').where({ id: req.params.id }).first();
        if (!current) {
            return res.status(404).json({ error: 'Reference document not found.' });
        }

        const duplicate = await db('reference_documents')
            .where({ service_id: current.service_id })
            .whereNot({ id: req.params.id })
            .andWhereRaw('LOWER(name) = LOWER(?)', [name])
            .andWhereRaw('LOWER(COALESCE(file_url, \'\')) = LOWER(?)', [file_url || ''])
            .first();
        if (duplicate) {
            return res.status(409).json({ error: 'A reference document with the same name and URL already exists for this service.' });
        }

        const [doc] = await db('reference_documents')
            .where({ id: req.params.id })
            .update({ name, file_url: fileUrlOrNull, description, updated_at: db.fn.now() })
            .returning('*');
        res.json(doc);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update reference document.' });
    }
});

// DELETE /api/services/reference_documents/:id
router.delete('/reference_documents/:id', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        await db('reference_documents').where({ id: req.params.id }).delete();
        res.json({ message: 'Reference document permanently deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete reference document.' });
    }
});

// POST /api/services/tasks/:taskId/documents
router.post('/tasks/:taskId/documents', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        const { document_id } = req.body;
        if (!document_id) return res.status(400).json({ error: 'document_id is required.' });

        await db('service_task_documents').insert({
            service_task_id: req.params.taskId,
            document_id
        }).onConflict(['service_task_id', 'document_id']).ignore(); // Ignore if already mapped

        res.status(201).json({ message: 'Document linked to task.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to link document.' });
    }
});

// DELETE /api/services/tasks/:taskId/documents/:docId
router.delete('/tasks/:taskId/documents/:docId', authenticate, authorize('services', 'can_edit'), async (req, res) => {
    try {
        await db('service_task_documents')
            .where({ service_task_id: req.params.taskId, document_id: req.params.docId })
            .delete();
        res.json({ message: 'Document unlinked from task.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to unlink document.' });
    }
});

module.exports = router;

