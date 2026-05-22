/**
 * Seed: Services & Service Tasks
 * Inserts the initial "Time & Motion" service with its standard task templates.
 */
exports.seed = async function (knex) {
    // Clear existing
    await knex('service_tasks').del();
    await knex('services').del();

    // Insert Time & Motion service
    const [service] = await knex('services')
        .insert({
            id: 1,
            name: 'Time & Motion',
            code: 'TM',
            description:
                'Time & Motion study service — analyzing work processes to optimize productivity and efficiency.',
            is_active: true,
        })
        .returning('id');

    const serviceId = typeof service === 'object' ? service.id : service;

    // Insert standard tasks for Time & Motion
    
    // First, insert a default step for Time & Motion
    const [step] = await knex('service_steps')
        .insert({
            service_id: serviceId,
            name: 'Execution Phase',
            description: 'Main execution phase.',
            sequence_order: 1,
            is_active: true
        })
        .returning('id');

    const stepId = typeof step === 'object' ? step.id : step;

    await knex('service_tasks').insert([
        {
            service_step_id: stepId,
            name: 'Project Kickoff & Planning',
            description: 'Initial meeting with client, define scope, objectives, and timeline.',
            default_duration_days: 3,
            sequence_order: 1,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Process Mapping',
            description: 'Document current processes and workflows across departments.',
            default_duration_days: 7,
            sequence_order: 2,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Data Collection Setup',
            description: 'Set up data collection tools, forms, and measurement criteria.',
            default_duration_days: 5,
            sequence_order: 3,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Time Study Observation',
            description: 'Conduct on-floor time study observations across all targeted areas.',
            default_duration_days: 14,
            sequence_order: 4,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Motion Analysis',
            description: 'Analyze worker movements, identify waste, and map value-added vs. non-value-added activities.',
            default_duration_days: 10,
            sequence_order: 5,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Data Analysis & Benchmarking',
            description: 'Analyze collected data, compute standard times, and benchmark against industry standards.',
            default_duration_days: 7,
            sequence_order: 6,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Improvement Recommendations',
            description: 'Develop actionable recommendations for process improvements.',
            default_duration_days: 5,
            sequence_order: 7,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Draft Report Preparation',
            description: 'Prepare the draft Time & Motion study report with findings and recommendations.',
            default_duration_days: 5,
            sequence_order: 8,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Client Review & Feedback',
            description: 'Present draft report to client, collect feedback, and address queries.',
            default_duration_days: 5,
            sequence_order: 9,
            is_mandatory: true,
        },
        {
            service_step_id: stepId,
            name: 'Final Report & Handover',
            description: 'Finalize report incorporating feedback, deliver to client, and project closure.',
            default_duration_days: 3,
            sequence_order: 10,
            is_mandatory: true,
        }
    ]);
};
