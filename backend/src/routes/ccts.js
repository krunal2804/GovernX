const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const BULK_COLUMNS = {
    CATEGORY_NAME: 'Category Name',
    PARTICULAR_NAME: 'Particular Name',
};

function normalizeCCTRows(rows) {
    const normalized = [];
    let currentCategoryName = '';

    rows.forEach((rawRow, index) => {
        const rowNumber = index + 2;
        const categoryNameRaw = String(rawRow[BULK_COLUMNS.CATEGORY_NAME] ?? '').trim();
        const particularName = String(rawRow[BULK_COLUMNS.PARTICULAR_NAME] ?? '').trim();

        if (!categoryNameRaw && !particularName) return;

        const errors = [];
        if (categoryNameRaw) currentCategoryName = categoryNameRaw;
        if (!currentCategoryName) errors.push('Category Name is required on first row of each category block');
        if (!particularName) errors.push('Particular Name is required');

        normalized.push({
            id: Date.now() + index,
            row_number: rowNumber,
            category_name: currentCategoryName,
            particular_name: particularName,
            errors,
        });
    });

    return normalized;
}

router.get('/bulk/upload/sample-excel', authenticate, (req, res) => {
    const samplePath = path.resolve(__dirname, '../assets/samples/sample_cct.xlsx');
    if (!fs.existsSync(samplePath)) {
        return res.status(404).json({ error: 'Sample file not found on server.' });
    }

    return res.download(samplePath, 'sample_cct.xlsx');
});

router.post('/:id/upload/validate', authenticate, authorize('assignments', 'can_edit'), upload.single('file'), async (req, res) => {
    try {
        const plan = await db('ccts').where({ id: req.params.id }).first();
        if (!plan) return res.status(404).json({ error: 'Client Commitment Tracker not found.' });
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsedRows = normalizeCCTRows(rows);

        if (parsedRows.length === 0) {
            return res.status(400).json({ error: 'Excel has no usable rows. Please add data rows.' });
        }
        res.json({ rows: parsedRows });
    } catch (err) {
        console.error('Client Commitment Tracker upload validate error:', err);
        res.status(500).json({ error: `Failed to validate file: ${err.message}` });
    }
});

router.post('/:id/upload/confirm', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const cctId = req.params.id;
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided.' });

        const normalized = normalizeCCTRows(rows.map((r) => ({
            [BULK_COLUMNS.CATEGORY_NAME]: r.category_name,
            [BULK_COLUMNS.PARTICULAR_NAME]: r.particular_name,
        })));
        if (normalized.length === 0) return res.status(400).json({ error: 'No usable rows after validation.' });

        const invalidRows = normalized.filter((r) => r.errors.length > 0);
        if (invalidRows.length > 0) {
            return res.status(400).json({ error: 'Some rows are invalid. Please fix errors in preview first.', rows: normalized });
        }

        const byCategory = new Map();
        normalized.forEach((row) => {
            if (!byCategory.has(row.category_name)) byCategory.set(row.category_name, []);
            byCategory.get(row.category_name).push(row.particular_name);
        });

        await db.transaction(async (trx) => {
            const existingCategories = await trx('cct_categories').where({ cct_id: cctId }).select('id');
            const existingCategoryIds = existingCategories.map((c) => c.id);
            if (existingCategoryIds.length > 0) {
                await trx('cct_categories').whereIn('id', existingCategoryIds).del();
            }

            let categoryIndex = 0;
            for (const [categoryName, particulars] of byCategory.entries()) {
                const [category] = await trx('cct_categories').insert({
                    cct_id: cctId,
                    name: categoryName,
                    description: null,
                    sequence_order: categoryIndex,
                }).returning('*');

                for (let i = 0; i < particulars.length; i += 1) {
                    await trx('cct_particulars').insert({
                        cct_category_id: category.id,
                        name: particulars[i],
                        description: null,
                        sequence_order: i,
                    });
                }
                categoryIndex += 1;
            }
        });

        res.json({ message: 'Client Commitment Tracker categories and particulars replaced successfully.' });
    } catch (err) {
        console.error('Client Commitment Tracker upload confirm error:', err);
        res.status(500).json({ error: `Failed to apply upload: ${err.message}` });
    }
});

router.get('/', authenticate, async (req, res) => {
    try {
        const plans = await db('ccts').orderBy('name');
        res.json(plans);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch ccts.' });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const plan = await db('ccts').where({ id: req.params.id }).first();
        if (!plan) return res.status(404).json({ error: 'Client Commitment Tracker not found.' });

        const categories = await db('cct_categories')
            .where({ cct_id: plan.id })
            .orderBy('sequence_order')
            .orderBy('id');

        for (const category of categories) {
            category.particulars = await db('cct_particulars')
                .where({ cct_category_id: category.id })
                .orderBy('sequence_order')
                .orderBy('id');
        }

        res.json({ ...plan, categories });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cct details.' });
    }
});

router.post('/', authenticate, authorize('assignments', 'can_edit'), authorize('assignments', 'can_create'), async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = req.body.description ?? null;
        if (!name) return res.status(400).json({ error: 'Name is required.' });

        const [plan] = await db('ccts').insert({ name, description }).returning('*');
        res.status(201).json(plan);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Client Commitment Tracker name already exists.' });
        res.status(500).json({ error: 'Failed to create cct.' });
    }
});

router.put('/:id', authenticate, authorize('assignments', 'can_edit'), authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = req.body.description ?? null;
        if (!name) return res.status(400).json({ error: 'Name is required.' });

        const [plan] = await db('ccts')
            .where({ id: req.params.id })
            .update({ name, description, updated_at: db.fn.now() })
            .returning('*');
        if (!plan) return res.status(404).json({ error: 'Client Commitment Tracker not found.' });
        res.json(plan);
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Client Commitment Tracker name already exists.' });
        res.status(500).json({ error: 'Failed to update cct.' });
    }
});

router.delete('/:id', authenticate, authorize('assignments', 'can_edit'), authorize('assignments', 'can_delete'), async (req, res) => {
    try {
        await db('ccts').where({ id: req.params.id }).delete();
        res.json({ message: 'Client Commitment Tracker deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete cct.' });
    }
});

router.post('/:id/categories', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const cctId = req.params.id;
        const name = String(req.body.name || '').trim();
        const description = req.body.description ?? null;
        let { sequence_order } = req.body;

        if (sequence_order === undefined || sequence_order === null) {
            const last = await db('cct_categories')
                .where({ cct_id: cctId })
                .orderBy('sequence_order', 'desc')
                .first();
            sequence_order = last ? last.sequence_order + 1 : 0;
        }

        const [category] = await db('cct_categories').insert({
            cct_id: cctId,
            name: name || null,
            description,
            sequence_order,
        }).returning('*');
        res.status(201).json(category);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create category.' });
    }
});

router.put('/categories/:categoryId', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = req.body.description ?? null;
        const updateData = { name: name || null, description, updated_at: db.fn.now() };
        if (req.body.sequence_order !== undefined) updateData.sequence_order = req.body.sequence_order;

        const [category] = await db('cct_categories')
            .where({ id: req.params.categoryId })
            .update(updateData)
            .returning('*');
        if (!category) return res.status(404).json({ error: 'Category not found.' });
        res.json(category);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update category.' });
    }
});

router.delete('/categories/:categoryId', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        await db('cct_categories').where({ id: req.params.categoryId }).delete();
        res.json({ message: 'Category deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});

router.post('/categories/:categoryId/particulars', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const name = String(req.body.name || '').trim();
        const description = req.body.description ?? null;
        if (!name) return res.status(400).json({ error: 'Particular name is required.' });

        let { sequence_order } = req.body;
        if (sequence_order === undefined || sequence_order === null) {
            const last = await db('cct_particulars')
                .where({ cct_category_id: categoryId })
                .orderBy('sequence_order', 'desc')
                .first();
            sequence_order = last ? last.sequence_order + 1 : 0;
        }

        const [particular] = await db('cct_particulars').insert({
            cct_category_id: categoryId,
            name,
            description,
            sequence_order,
        }).returning('*');
        res.status(201).json(particular);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create particular.' });
    }
});

router.put('/particulars/:particularId', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = req.body.description ?? null;
        if (!name) return res.status(400).json({ error: 'Particular name is required.' });

        const updateData = { name, description, updated_at: db.fn.now() };
        if (req.body.sequence_order !== undefined) updateData.sequence_order = req.body.sequence_order;

        const [particular] = await db('cct_particulars')
            .where({ id: req.params.particularId })
            .update(updateData)
            .returning('*');
        if (!particular) return res.status(404).json({ error: 'Particular not found.' });
        res.json(particular);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update particular.' });
    }
});

router.delete('/particulars/:particularId', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        await db('cct_particulars').where({ id: req.params.particularId }).delete();
        res.json({ message: 'Particular deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete particular.' });
    }
});

module.exports = router;

