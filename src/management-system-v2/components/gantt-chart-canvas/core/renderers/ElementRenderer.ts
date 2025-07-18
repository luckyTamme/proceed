/**
 * ElementRenderer.ts
 *
 * Handles rendering of Gantt chart elements (tasks, milestones, groups).
 * Implements optimized rendering strategies for different element types.
 */

import { TimeMatrix } from '../TimeMatrix';
import { GanttElementType } from '../../types';
import { drawRoundedRect, drawText } from '../renderUtils';
import {
  ROW_HEIGHT,
  TASK_PADDING,
  MILESTONE_SIZE,
  TASK_DEFAULT_COLOR,
  MILESTONE_DEFAULT_COLOR,
  GROUP_DEFAULT_COLOR,
  HOVER_OPACITY,
  ELEMENT_MIN_WIDTH,
} from '../constants';
import { darken, hexToRgba } from '../../utils/colorUtils';

export class ElementRenderer {
  private pixelRatio: number = 1;
  private showLoopIcons: boolean = true;

  constructor(pixelRatio: number = 1, showLoopIcons: boolean = true) {
    this.pixelRatio = pixelRatio;
    this.showLoopIcons = showLoopIcons;
  }

  /**
   * Update element renderer configuration
   */
  updateConfig(config: { showLoopIcons?: boolean }) {
    if (config.showLoopIcons !== undefined) {
      this.showLoopIcons = config.showLoopIcons;
    }
  }

  /**
   * Render a task bar element
   */
  renderTask(
    context: CanvasRenderingContext2D,
    task: GanttElementType & { type: 'task'; start: number; end: number },
    rowIndex: number,
    timeMatrix: TimeMatrix,
    visibleRowStart: number = 0,
    isHovered: boolean = false,
  ): void {
    // Check for invalid timestamps
    const validStart = task.start && task.start > 0;
    const validEnd = task.end && task.end > 0;
    const hasTimestampIssue = !validStart || !validEnd;

    // For elements with invalid timestamps, use fixed positions
    let startX: number, endX: number, width: number;

    if (hasTimestampIssue) {
      // For invalid timestamps, position at a fixed point
      const viewportWidth = context.canvas.width / this.pixelRatio;
      startX = viewportWidth * 0.15;
      width = viewportWidth * 0.2;
      endX = startX + width;
    } else {
      // Normal calculation for valid timestamps
      startX = timeMatrix.transformPoint(task.start);
      endX = timeMatrix.transformPoint(task.end);
      width = Math.max(endX - startX, ELEMENT_MIN_WIDTH);
      endX = startX + width;
    }

    // Use absolute row position
    const y = rowIndex * ROW_HEIGHT + TASK_PADDING;
    const height = ROW_HEIGHT - TASK_PADDING * 2;

    // Skip if completely outside visible area
    if (endX < 0 || startX > context.canvas.width / this.pixelRatio) {
      return;
    }

    // Draw main task bar
    const color = task.color || TASK_DEFAULT_COLOR;

    // Save context state for clipping
    context.save();

    // Set up clipping region to prevent drawing outside the task's actual bounds
    context.beginPath();
    context.rect(
      Math.max(0, startX), // Clip left edge to canvas
      y,
      Math.min(width, context.canvas.width / this.pixelRatio - startX), // Clip right edge to canvas
      height,
    );
    context.clip();

    // Draw the task bar at its actual position (not clipped position)
    drawRoundedRect(
      context,
      Math.floor(startX),
      Math.floor(y),
      Math.ceil(width),
      Math.ceil(height),
      0, // No rounding for tasks
      {
        fillStyle: isHovered ? darken(color, 10) : color,
        globalAlpha: isHovered ? HOVER_OPACITY : 1,
      },
    );

    // Restore context to remove clipping
    context.restore();

    // Draw task label if there's enough space - use original element width, not clipped
    if (width > 20 && task.name) {
      // Create label with instance number if applicable
      let label = task.name;
      if (task.instanceNumber && task.totalInstances && task.totalInstances > 1) {
        label += ` #${task.instanceNumber}`;
      }
      if (this.showLoopIcons) {
        if (task.isLoopCut) {
          label += ' ✕';
        } else if (task.isLoop) {
          label += ' ↻';
        }
      }

      this.drawLabel(
        context,
        label,
        startX + 4, // Use original startX, not clippedStartX
        y + height / 2,
        width - 8, // Use original width, not clippedWidth
        '#ffffff',
      );
    }

    // Render ghost occurrences if present
    if (task.ghostOccurrences && task.ghostOccurrences.length > 0) {
      this.renderGhostOccurrences(context, task.ghostOccurrences, rowIndex, timeMatrix, color);
    }

    context.globalAlpha = 1;
  }

  /**
   * Render a milestone element
   */
  renderMilestone(
    context: CanvasRenderingContext2D,
    milestone: GanttElementType & { type: 'milestone'; start: number; end?: number },
    rowIndex: number,
    timeMatrix: TimeMatrix,
    visibleRowStart: number = 0,
    isHovered: boolean = false,
  ): void {
    const startX = timeMatrix.transformPoint(milestone.start);
    const endX = milestone.end ? timeMatrix.transformPoint(milestone.end) : startX;
    const hasRange = milestone.end && milestone.end !== milestone.start;

    // Calculate milestone position - centered if there's a range, otherwise at start
    const milestoneX = hasRange ? (startX + endX) / 2 : startX;

    // Skip if completely outside visible area
    const canvasWidth = context.canvas.width / this.pixelRatio;
    if (endX < -MILESTONE_SIZE || startX > canvasWidth + MILESTONE_SIZE) {
      return;
    }

    // Use absolute row position
    const y = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const color = milestone.color || MILESTONE_DEFAULT_COLOR;

    // If there's a range, only draw it if the visual width is sufficient
    if (hasRange) {
      const rangeWidth = endX - startX;
      const minimumRangeWidth = MILESTONE_SIZE * 1.5; // Milestone size + 50%

      // Only render the range visual if it's wide enough
      if (rangeWidth > minimumRangeWidth) {
        context.save();

        // Create clipping region for the range area
        const rangeHeight = ROW_HEIGHT - 8;
        const rangeY = y - rangeHeight / 2;

        context.beginPath();
        context.rect(startX, rangeY, rangeWidth, rangeHeight);
        context.clip();

        // Draw slanted lines pattern
        context.strokeStyle = hexToRgba(color, 0.15);
        context.lineWidth = 1;
        const lineSpacing = 6;

        // Draw diagonal lines at 45 degree angle
        for (let i = startX - rangeHeight; i < endX + rangeHeight; i += lineSpacing) {
          context.beginPath();
          context.moveTo(i, rangeY);
          context.lineTo(i + rangeHeight, rangeY + rangeHeight);
          context.stroke();
        }

        context.restore();

        // Draw brackets at the ends
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.globalAlpha = isHovered ? HOVER_OPACITY : 1;

        const bracketSize = 6;

        // Left bracket
        context.beginPath();
        context.moveTo(startX + bracketSize, rangeY);
        context.lineTo(startX, rangeY);
        context.lineTo(startX, rangeY + rangeHeight);
        context.lineTo(startX + bracketSize, rangeY + rangeHeight);
        context.stroke();

        // Right bracket
        context.beginPath();
        context.moveTo(endX - bracketSize, rangeY);
        context.lineTo(endX, rangeY);
        context.lineTo(endX, rangeY + rangeHeight);
        context.lineTo(endX - bracketSize, rangeY + rangeHeight);
        context.stroke();
      }
    }

    // Draw diamond shape at the milestone position
    context.fillStyle = isHovered ? darken(color, 10) : color;
    context.globalAlpha = isHovered ? HOVER_OPACITY : 1;

    context.beginPath();
    context.moveTo(milestoneX, y - MILESTONE_SIZE / 2);
    context.lineTo(milestoneX + MILESTONE_SIZE / 2, y);
    context.lineTo(milestoneX, y + MILESTONE_SIZE / 2);
    context.lineTo(milestoneX - MILESTONE_SIZE / 2, y);
    context.closePath();
    context.fill();

    // Draw milestone label
    if (milestone.name) {
      // Create label with instance number if applicable
      let label = milestone.name;
      if (milestone.instanceNumber && milestone.totalInstances && milestone.totalInstances > 1) {
        label += ` #${milestone.instanceNumber}`;
      }
      if (this.showLoopIcons) {
        if (milestone.isLoopCut) {
          label += ' ✕';
        } else if (milestone.isLoop) {
          label += ' ↻';
        }
      }

      this.drawLabelWithBackground(
        context,
        label,
        milestoneX + MILESTONE_SIZE / 2 + 4,
        y,
        200,
        '#333333',
      );
    }

    // Render ghost occurrences if present
    if (milestone.ghostOccurrences && milestone.ghostOccurrences.length > 0) {
      this.renderGhostMilestones(context, milestone.ghostOccurrences, rowIndex, timeMatrix, color);
    }

    context.globalAlpha = 1;
  }

  /**
   * Render a group element
   */
  renderGroup(
    context: CanvasRenderingContext2D,
    group: GanttElementType & { type: 'group'; start: number; end: number },
    rowIndex: number,
    timeMatrix: TimeMatrix,
    visibleRowStart: number = 0,
    isHovered: boolean = false,
  ): void {
    const startX = timeMatrix.transformPoint(group.start);
    const endX = timeMatrix.transformPoint(group.end);
    const width = Math.max(endX - startX, ELEMENT_MIN_WIDTH);

    // Skip if completely outside visible area
    if (endX < 0 || startX > context.canvas.width / this.pixelRatio) {
      return;
    }

    // Use absolute row position
    const y = rowIndex * ROW_HEIGHT + 2;
    const height = ROW_HEIGHT - 4;

    const color = group.color || GROUP_DEFAULT_COLOR;
    context.strokeStyle = isHovered ? darken(color, 10) : color;
    context.lineWidth = 2 * this.pixelRatio;
    context.globalAlpha = isHovered ? HOVER_OPACITY : 1;

    // Draw group bracket at actual positions
    context.beginPath();

    // Left bracket
    const leftBracketX = startX;
    const rightBracketX = startX + width;

    // Only draw visible parts of brackets
    if (leftBracketX >= -5 && leftBracketX <= context.canvas.width / this.pixelRatio) {
      context.moveTo(leftBracketX + 5, y);
      context.lineTo(leftBracketX, y);
      context.lineTo(leftBracketX, y + height);
      context.lineTo(leftBracketX + 5, y + height);
    }

    // Right bracket
    if (rightBracketX >= 0 && rightBracketX <= context.canvas.width / this.pixelRatio + 5) {
      context.moveTo(rightBracketX - 5, y);
      context.lineTo(rightBracketX, y);
      context.lineTo(rightBracketX, y + height);
      context.lineTo(rightBracketX - 5, y + height);
    }

    context.stroke();

    // Draw group label - use original width, not clipped
    if (width > 30 && group.name) {
      // Create label with instance number if applicable
      let label = group.name;
      if (group.instanceNumber && group.totalInstances && group.totalInstances > 1) {
        label += ` #${group.instanceNumber}`;
      }
      if (this.showLoopIcons) {
        if (group.isLoopCut) {
          label += ' ✕';
        } else if (group.isLoop) {
          label += ' ↻';
        }
      }

      this.drawLabel(
        context,
        label,
        startX + width / 2, // Use original startX and width, not clipped
        y + 2,
        width - 10, // Use original width, not clippedWidth
        color,
        'center',
        'top',
        true, // bold
      );
    }

    context.globalAlpha = 1;
  }

  /**
   * Render all visible elements
   */
  renderElements(
    context: CanvasRenderingContext2D,
    elements: GanttElementType[],
    timeMatrix: TimeMatrix,
    visibleRowStart: number,
    visibleRowEnd: number,
    hoveredElementId?: string,
  ): { visibleElements: GanttElementType[] } {
    // Track which elements are actually visible
    const visibleElements: GanttElementType[] = [];

    // Render all elements that fall within the visible row range
    // Always use the element's position in the original array as its row index
    elements.forEach((element, rowIndex) => {
      // Skip elements outside the visible row range
      if (rowIndex < visibleRowStart || rowIndex > visibleRowEnd) {
        return;
      }

      // Add to visible elements list
      visibleElements.push(element);

      // Render based on element type
      switch (element.type) {
        case 'group':
          this.renderGroup(
            context,
            element as GanttElementType & { type: 'group'; start: number; end: number },
            rowIndex,
            timeMatrix,
            visibleRowStart,
            element.id === hoveredElementId,
          );
          break;

        case 'task':
          this.renderTask(
            context,
            element as GanttElementType & { type: 'task'; start: number; end: number },
            rowIndex,
            timeMatrix,
            visibleRowStart,
            element.id === hoveredElementId,
          );
          break;

        case 'milestone':
          this.renderMilestone(
            context,
            element as GanttElementType & { type: 'milestone'; start: number; end?: number },
            rowIndex,
            timeMatrix,
            visibleRowStart,
            element.id === hoveredElementId,
          );
          break;
      }
    });

    return { visibleElements };
  }

  /**
   * Draw text with ellipsis if it's too long
   */
  private drawLabel(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color: string,
    textAlign: CanvasTextAlign = 'left',
    textBaseline: CanvasTextBaseline = 'middle',
    bold: boolean = false,
  ): void {
    // Dynamic font sizing based on device pixel ratio
    // The issue: Mac scaled displays report pixelRatio=2 but render larger than expected
    let fontSize = 12;

    // Much more aggressive reduction for high-DPI displays
    if (this.pixelRatio >= 2) {
      fontSize = 6.5; // Very small for Retina displays
    } else if (this.pixelRatio > 1.5) {
      fontSize = 9;
    } else if (this.pixelRatio > 1) {
      fontSize = 10.5;
    }

    const fontFamily =
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

    context.save();
    context.scale(this.pixelRatio, this.pixelRatio);

    drawText(context, text, x / this.pixelRatio, y / this.pixelRatio, maxWidth / this.pixelRatio, {
      font: `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`,
      fillStyle: color,
      textAlign,
      textBaseline,
    });

    context.restore();
  }

  /**
   * Draw text with a semi-transparent background for better readability
   */
  private drawLabelWithBackground(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    color: string,
    textAlign: CanvasTextAlign = 'left',
    textBaseline: CanvasTextBaseline = 'middle',
    bold: boolean = false,
  ): void {
    // Dynamic font sizing based on device pixel ratio
    let fontSize = 12;

    if (this.pixelRatio >= 2) {
      fontSize = 6.5;
    } else if (this.pixelRatio > 1.5) {
      fontSize = 9;
    } else if (this.pixelRatio > 1) {
      fontSize = 10.5;
    }

    const fontFamily =
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

    context.save();
    context.scale(this.pixelRatio, this.pixelRatio);

    // Set font for text measurement
    context.font = `${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
    context.textAlign = textAlign;
    context.textBaseline = textBaseline;

    // Calculate actual text dimensions
    const scaledX = x / this.pixelRatio;
    const scaledY = y / this.pixelRatio;
    const scaledMaxWidth = maxWidth / this.pixelRatio;

    // Measure the text that will actually be drawn (with ellipsis if needed)
    const displayText = scaledMaxWidth
      ? this.measureTextWithEllipsis(context, text, scaledMaxWidth)
      : text;
    const textMetrics = context.measureText(displayText);
    const textWidth = textMetrics.width;
    const textHeight = fontSize; // Approximate text height

    // Calculate background rectangle position based on text alignment
    let bgX = scaledX;
    if (textAlign === 'center') {
      bgX = scaledX - textWidth / 2;
    } else if (textAlign === 'right') {
      bgX = scaledX - textWidth;
    }

    let bgY = scaledY;
    if (textBaseline === 'middle') {
      bgY = scaledY - textHeight / 2;
    } else if (textBaseline === 'bottom') {
      bgY = scaledY - textHeight;
    }

    // Add padding around text
    const padding = 2;
    bgX -= padding;
    bgY -= padding;
    const bgWidth = textWidth + padding * 2;
    const bgHeight = textHeight + padding * 2;

    // Draw semi-transparent background
    context.fillStyle = 'rgba(255, 255, 255, 0.65)';
    context.fillRect(bgX, bgY, bgWidth, bgHeight);

    // Draw the text
    context.fillStyle = color;
    context.fillText(displayText, scaledX, scaledY);

    context.restore();
  }

  /**
   * Measure text with ellipsis (similar to the utility function but adapted for use here)
   */
  private measureTextWithEllipsis(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string {
    const fullWidth = context.measureText(text).width;
    if (fullWidth <= maxWidth) return text;

    const ellipsis = '...';
    const ellipsisWidth = context.measureText(ellipsis).width;

    // Binary search for optimal text length
    let left = 0;
    let right = text.length;
    let result = '';

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.substring(0, mid) + ellipsis;
      const width = context.measureText(truncated).width;

      if (width <= maxWidth) {
        result = truncated;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result || ellipsis;
  }

  /**
   * Render ghost occurrences for task elements
   */
  private renderGhostOccurrences(
    context: CanvasRenderingContext2D,
    ghostOccurrences: Array<{ start: number; end?: number }>,
    rowIndex: number,
    timeMatrix: TimeMatrix,
    color: string,
  ): void {
    const y = rowIndex * ROW_HEIGHT + TASK_PADDING;
    const height = ROW_HEIGHT - TASK_PADDING * 2;

    context.save();
    context.globalAlpha = 0.75; // Ghost opacity

    ghostOccurrences.forEach((ghost) => {
      const startX = timeMatrix.transformPoint(ghost.start);
      const endX = timeMatrix.transformPoint(ghost.end || ghost.start);
      const width = Math.max(endX - startX, ELEMENT_MIN_WIDTH);

      // Skip if completely outside visible area
      if (startX + width < 0 || startX > context.canvas.width / this.pixelRatio) {
        return;
      }

      // Draw ghost task bar (fill only, no border)
      context.fillStyle = color;
      context.fillRect(Math.floor(startX), Math.floor(y), Math.ceil(width), Math.ceil(height));
    });

    context.restore();
  }

  /**
   * Render ghost occurrences for milestone elements
   */
  private renderGhostMilestones(
    context: CanvasRenderingContext2D,
    ghostOccurrences: Array<{ start: number; end?: number }>,
    rowIndex: number,
    timeMatrix: TimeMatrix,
    color: string,
  ): void {
    const y = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

    context.save();
    context.globalAlpha = 0.75; // Ghost opacity
    context.fillStyle = color;

    ghostOccurrences.forEach((ghost) => {
      const ghostX = timeMatrix.transformPoint(ghost.start);

      // Skip if completely outside visible area
      if (
        ghostX < -MILESTONE_SIZE ||
        ghostX > context.canvas.width / this.pixelRatio + MILESTONE_SIZE
      ) {
        return;
      }

      // Draw ghost milestone diamond
      context.beginPath();
      context.moveTo(ghostX, y - MILESTONE_SIZE / 2);
      context.lineTo(ghostX + MILESTONE_SIZE / 2, y);
      context.lineTo(ghostX, y + MILESTONE_SIZE / 2);
      context.lineTo(ghostX - MILESTONE_SIZE / 2, y);
      context.closePath();
      context.fill();
    });

    context.restore();
  }
}
