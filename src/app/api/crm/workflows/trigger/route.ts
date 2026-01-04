import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/crm/workflows/trigger - Trigger workflow execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trigger, data } = body;

    if (!trigger || !data) {
      return NextResponse.json(
        { error: 'Trigger and data are required' },
        { status: 400 }
      );
    }

    // Find active workflows for this trigger
    const workflows = await db.workflow.findMany({
      where: {
        trigger,
        isActive: true
      }
    });

    const results = [];

    for (const workflow of workflows) {
      try {
        // Check conditions
        const conditions = JSON.parse(workflow.conditions);
        if (await evaluateConditions(conditions, data)) {
          // Execute workflow
          const execution = await executeWorkflow(workflow, data);
          results.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'executed',
            execution
          });
        } else {
          results.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'conditions_not_met'
          });
        }
      } catch (error) {
        console.error(`Error executing workflow ${workflow.id}:`, error);
        results.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: 'Workflow trigger processed',
      results
    });
  } catch (error) {
    console.error('Error triggering workflows:', error);
    return NextResponse.json(
      { error: 'Failed to trigger workflows' },
      { status: 500 }
    );
  }
}

// Evaluate workflow conditions
async function evaluateConditions(conditions: any, data: any): Promise<boolean> {
  // Simple condition evaluation - can be extended for complex logic
  for (const condition of conditions) {
    const { field, operator, value } = condition;
    
    let fieldValue = getNestedValue(data, field);
    
    switch (operator) {
      case 'equals':
        if (fieldValue !== value) return false;
        break;
      case 'not_equals':
        if (fieldValue === value) return false;
        break;
      case 'contains':
        if (!fieldValue || !fieldValue.toString().includes(value)) return false;
        break;
      case 'greater_than':
        if (parseFloat(fieldValue) <= parseFloat(value)) return false;
        break;
      case 'less_than':
        if (parseFloat(fieldValue) >= parseFloat(value)) return false;
        break;
      case 'in':
        if (!value.includes(fieldValue)) return false;
        break;
      default:
        return false;
    }
  }
  
  return true;
}

// Execute workflow actions
async function executeWorkflow(workflow: any, data: any) {
  const actions = JSON.parse(workflow.actions);
  const results = [];

  // Create workflow execution record
  const execution = await db.workflowExecution.create({
    data: {
      workflowId: workflow.id,
      triggerData: JSON.stringify(data),
      status: 'RUNNING'
    }
  });

  try {
    for (const action of actions) {
      const result = await executeAction(action, data);
      results.push(result);
    }

    // Update execution as completed
    await db.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        result: JSON.stringify(results),
        completedAt: new Date()
      }
    });

    // Update workflow run count
    await db.workflow.update({
      where: { id: workflow.id },
      data: {
        runCount: { increment: 1 },
        lastRunAt: new Date()
      }
    });

  } catch (error) {
    // Update execution as failed
    await db.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      }
    });
    throw error;
  }

  return {
    executionId: execution.id,
    results
  };
}

// Execute individual action
async function executeAction(action: any, data: any) {
  const { type, config } = action;

  switch (type) {
    case 'send_email':
      return await sendEmailAction(config, data);
    case 'create_task':
      return await createTaskAction(config, data);
    case 'update_contact':
      return await updateContactAction(config, data);
    case 'update_deal':
      return await updateDealAction(config, data);
    case 'send_notification':
      return await sendNotificationAction(config, data);
    case 'webhook':
      return await webhookAction(config, data);
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// Action implementations
async function sendEmailAction(config: any, data: any) {
  // TODO: Implement email sending logic
  return { type: 'email', status: 'sent', to: config.to, template: config.template };
}

async function createTaskAction(config: any, data: any) {
  const task = await db.task.create({
    data: {
      title: config.title,
      description: config.description,
      type: config.type,
      priority: config.priority,
      assignedTo: config.assignedTo,
      relatedTo: data.contactId || data.dealId,
      relatedType: data.contactId ? 'contact' : 'deal',
      createdBy: config.createdBy
    }
  });

  return { type: 'task', status: 'created', taskId: task.id };
}

async function updateContactAction(config: any, data: any) {
  if (!data.contactId) {
    throw new Error('Contact ID required for update contact action');
  }

  const updateData: any = {};
  if (config.status) updateData.status = config.status;
  if (config.priority) updateData.priority = config.priority;
  if (config.assignedTo) updateData.assignedTo = config.assignedTo;

  const contact = await db.contact.update({
    where: { id: data.contactId },
    data: updateData
  });

  return { type: 'contact', status: 'updated', contactId: contact.id };
}

async function updateDealAction(config: any, data: any) {
  if (!data.dealId) {
    throw new Error('Deal ID required for update deal action');
  }

  const updateData: any = {};
  if (config.stage) updateData.stage = config.stage;
  if (config.status) updateData.status = config.status;
  if (config.assignedTo) updateData.assignedTo = config.assignedTo;

  const deal = await db.deal.update({
    where: { id: data.dealId },
    data: updateData
  });

  return { type: 'deal', status: 'updated', dealId: deal.id };
}

async function sendNotificationAction(config: any, data: any) {
  // TODO: Implement notification sending (Slack, email, in-app)
  return { type: 'notification', status: 'sent', message: config.message };
}

async function webhookAction(config: any, data: any) {
  // TODO: Implement webhook call
  return { type: 'webhook', status: 'sent', url: config.url };
}

// Helper function to get nested object values
function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}