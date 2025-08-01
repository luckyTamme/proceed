/**
 * BPMN Element Transformation Functions
 *
 * This module contains functions that transform individual BPMN elements
 * (tasks, events, sequence flows) into their corresponding Gantt chart representations.
 */

import type { GanttElementType, GanttDependency } from '@/components/gantt-chart-canvas/types';
import { DependencyType } from '@/components/gantt-chart-canvas/types';
import type {
  BPMNTask,
  BPMNEvent,
  BPMNSequenceFlow,
  BPMNGateway,
  BPMNFlowElement,
} from '../types/types';
import {
  getTaskTypeString,
  getEventTypeString,
  getGatewayTypeString,
  isBoundaryEventElement,
  isExpandedSubProcess,
} from '../utils/utils';
import {
  extractSourceId,
  extractTargetId,
  extractAttachedToId,
} from '../utils/reference-extractor';

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Lane Metadata Helper Functions
// ============================================================================

/**
 * Add lane metadata from BPMN element to Gantt element
 * Transfers lane information from BPMN elements to their Gantt representations
 */
function addLaneMetadata(ganttElement: GanttElementType, bpmnElement: any): void {
  if (bpmnElement._laneMetadata) {
    (ganttElement as any)._laneMetadata = {
      laneId: bpmnElement._laneMetadata.laneId,
      laneName: bpmnElement._laneMetadata.laneName,
      laneLevel: bpmnElement._laneMetadata.laneLevel,
    };
  }
}

/**
 * Inherit lane metadata from base element to instance element
 * Used when creating instance elements that need lane metadata from their base BPMN element
 */
export function inheritLaneMetadata(
  ganttElement: GanttElementType,
  baseElementId: string,
  bpmnElements: BPMNFlowElement[],
): void {
  // Find the base BPMN element (without instance suffix)
  const baseElement = bpmnElements.find((el) => el.id === baseElementId);
  if (baseElement && (baseElement as any)._laneMetadata) {
    (ganttElement as any)._laneMetadata = {
      laneId: (baseElement as any)._laneMetadata.laneId,
      laneName: (baseElement as any)._laneMetadata.laneName,
      laneLevel: (baseElement as any)._laneMetadata.laneLevel,
    };
  }
}

// ============================================================================
// Element Transformation Functions
// ============================================================================

/**
 * Transform BPMN task to Gantt task
 */
export function transformTask(
  task: BPMNTask,
  startTime: number,
  duration: number,
  color?: string,
): GanttElementType {
  const ganttTask: GanttElementType = {
    id: task.id,
    name: task.name,
    type: 'task',
    start: startTime,
    end: startTime + duration,
    elementType: getTaskTypeString(task),
    color,
  };

  // Add lane metadata if present
  addLaneMetadata(ganttTask, task);

  return ganttTask;
}

/**
 * Transform BPMN event to Gantt milestone
 * Using Option A: Events positioned at the end of their duration (completion time)
 */
export function transformEvent(
  event: BPMNEvent,
  startTime: number,
  duration: number,
  color?: string,
): GanttElementType {
  // Handle boundary events specially
  if (isBoundaryEventElement(event)) {
    return transformBoundaryEvent(event, startTime, duration, color);
  }

  let ganttEvent: GanttElementType;

  if (duration > 0) {
    // Event has duration - show the time range with milestone at completion time
    // Option A: milestone appears at event completion time but shows the full range
    ganttEvent = {
      id: event.id,
      name: event.name,
      type: 'milestone',
      start: startTime,
      end: startTime + duration,
      elementType: getEventTypeString(event),
      color,
    };
  } else {
    // Event has no duration - point milestone at start time
    ganttEvent = {
      id: event.id,
      name: event.name,
      type: 'milestone',
      start: startTime,
      elementType: getEventTypeString(event),
      color,
    };
  }

  // Add lane metadata if present
  addLaneMetadata(ganttEvent, event);

  return ganttEvent;
}

/**
 * Transform BPMN boundary event to Gantt milestone with boundary-specific properties
 */
export function transformBoundaryEvent(
  event: BPMNEvent,
  startTime: number,
  duration: number,
  color?: string,
): GanttElementType {
  const attachedToId = extractAttachedToId(event.attachedToRef);

  const ganttElement: GanttElementType = {
    id: event.id,
    name: event.name,
    type: 'milestone',
    start: startTime,
    elementType: getEventTypeString(event),
    color,
    // Boundary event specific properties
    isBoundaryEvent: true,
    attachedToId,
    cancelActivity: event.cancelActivity !== false, // Default to true if not specified
  };

  // Boundary events should always display as simple milestones
  // Duration only affects positioning, not visual representation

  // Add lane metadata if present
  addLaneMetadata(ganttElement, event);

  return ganttElement;
}

/**
 * Transform BPMN gateway to Gantt element
 * Gateways are always rendered as milestones (diamond shape)
 * If they have duration, the milestone will show the duration range
 */
export function transformGateway(
  gateway: BPMNGateway,
  startTime: number,
  duration: number,
  color?: string,
  isVisible: boolean = false,
): GanttElementType {
  const ganttElement: GanttElementType = {
    id: gateway.id,
    name: gateway.name,
    type: 'milestone', // Always render as milestone
    start: startTime,
    end: startTime + duration,
    elementType: getGatewayTypeString(gateway),
    color,
  };

  // Add lane metadata if present
  addLaneMetadata(ganttElement, gateway);

  return ganttElement;
}

/**
 * Transform expanded sub-process to Gantt group element
 * Renders as bracket/slash pattern without diamond milestone
 */
export function transformExpandedSubProcess(
  subProcess: any,
  startTime: number,
  duration: number,
  hierarchyLevel: number = 0,
  parentSubProcessId?: string,
  hasChildren: boolean = true,
  color?: string,
): GanttElementType {
  const ganttElement: GanttElementType = {
    id: subProcess.id,
    name: subProcess.name,
    type: 'group',
    start: startTime,
    end: startTime + duration,
    elementType: getTaskTypeString(subProcess),
    color,
    childIds: [], // Will be populated by the mode handlers
    isExpanded: true,
    isSubProcess: true,
    hasChildren,
    hierarchyLevel,
    parentSubProcessId,
  };

  // Add lane metadata if present
  addLaneMetadata(ganttElement, subProcess);

  return ganttElement;
}

/**
 * Determine flow type based on BPMN properties
 */
export function getFlowType(flow: BPMNSequenceFlow): 'conditional' | 'default' | 'normal' {
  // Check if flow has a condition expression (conditional flow)
  if (flow.conditionExpression) {
    return 'conditional';
  }

  // Check if flow is marked as default (from gateway default sequence flow)
  // In BPMN, default flows are typically marked on the gateway's default property
  // but we can also check for specific naming patterns or attributes
  if (
    flow.name &&
    (flow.name.toLowerCase().includes('default') || flow.name.toLowerCase().includes('else'))
  ) {
    return 'default';
  }

  return 'normal';
}

/**
 * Transform BPMN sequence flow to Gantt dependency
 */
export function transformSequenceFlow(flow: BPMNSequenceFlow): GanttDependency {
  // Handle case where sourceRef/targetRef might be ModdleElement objects or strings
  const sourceId =
    typeof flow.sourceRef === 'string'
      ? flow.sourceRef
      : (flow.sourceRef as any)?.id || flow.sourceRef;
  const targetId =
    typeof flow.targetRef === 'string'
      ? flow.targetRef
      : (flow.targetRef as any)?.id || flow.targetRef;

  return {
    id: flow.id,
    sourceId: sourceId,
    targetId: targetId,
    type: DependencyType.FINISH_TO_START, // BPMN sequence flows are finish-to-start dependencies
    name: flow.name,
    flowType: getFlowType(flow),
  };
}

// ============================================================================
// Gateway Detection and Transformation Functions
// ============================================================================

/**
 * Check if an element is a gateway
 */
export function isGatewayElement(element: BPMNFlowElement): element is BPMNGateway {
  return (
    element.$type === 'bpmn:ExclusiveGateway' ||
    element.$type === 'bpmn:InclusiveGateway' ||
    element.$type === 'bpmn:ParallelGateway' ||
    element.$type === 'bpmn:ComplexGateway' ||
    element.$type === 'bpmn:EventBasedGateway'
  );
}

/**
 * Check if an element is an exclusive gateway (XOR)
 */
export function isExclusiveGateway(element: BPMNFlowElement): element is BPMNGateway {
  return element.$type === 'bpmn:ExclusiveGateway';
}

/**
 * Check if an element is a parallel gateway (AND)
 */
export function isParallelGateway(element: BPMNFlowElement): element is BPMNGateway {
  return element.$type === 'bpmn:ParallelGateway';
}

/**
 * Check if an element is an inclusive gateway (OR)
 */
export function isInclusiveGateway(element: BPMNFlowElement): element is BPMNGateway {
  return element.$type === 'bpmn:InclusiveGateway';
}

/**
 * Check if an element is a complex gateway
 */
export function isComplexGateway(element: BPMNFlowElement): element is BPMNGateway {
  return element.$type === 'bpmn:ComplexGateway';
}

/**
 * Check if an element is an event-based gateway
 */
export function isEventBasedGateway(element: BPMNFlowElement): element is BPMNGateway {
  return element.$type === 'bpmn:EventBasedGateway';
}

// ============================================================================
// Boundary Event Helper Functions
// ============================================================================

/**
 * Create a boundary event dependency that visually connects the event to its attached task
 */
export function createBoundaryEventDependency(
  boundaryEventId: string,
  attachedTaskId: string,
  isInterrupting: boolean,
  boundaryEventName?: string,
): GanttDependency {
  return {
    id: `${boundaryEventId}_boundary_attachment`,
    sourceId: attachedTaskId,
    targetId: boundaryEventId,
    type: DependencyType.START_TO_START, // Boundary events are available when the task starts
    name: boundaryEventName,
    flowType: isInterrupting ? 'boundary' : 'boundary-non-interrupting',
    isBoundaryEvent: true,
  };
}
