'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Modal } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useGanttChart } from '../hooks/useGanttChart';
import { GanttChartOptions, GanttDependency, GanttElementType } from '../types';
import {
  CanvasRenderer,
  CanvasLayerType,
  ZoomCurveCalculator,
  TimeMatrix,
  RendererConfig,
} from '../core';
import { ElementManager } from '../core/ElementManager';
import { ROW_HEIGHT } from '../core/constants';

// Import CSS module
import styles from './GanttChartCanvas.module.scss';

interface GanttChartCanvasProps {
  elements: GanttElementType[];
  width?: string | number;
  height?: string | number;
  options?: GanttChartOptions;
  currentDateMarkerTime?: number; // Optional timestamp for the red marker line
  dependencies?: GanttDependency[]; // Optional list of dependency arrows between elements
  showInstanceColumn?: boolean; // Whether to show the instance number column
  showLoopColumn?: boolean; // Whether to show the loop status column
}

interface ElementInfoContentProps {
  element: GanttElementType;
  dependencies: GanttDependency[];
  elements: GanttElementType[];
  onElementClick: (elementId: string) => void;
}

/**
 * Component to display detailed information about an element
 */
const ElementInfoContent: React.FC<ElementInfoContentProps> = ({
  element,
  dependencies,
  elements,
  onElementClick,
}) => {
  // Create element lookup map
  const elementMap = new Map(elements.map((el) => [el.id, el]));

  // Get incoming and outgoing dependencies
  const incomingDeps = dependencies.filter((dep) => dep.targetId === element.id);
  const outgoingDeps = dependencies.filter((dep) => dep.sourceId === element.id);

  // Format duration for display
  const formatDuration = (start: number, end: number) => {
    const duration = end - start;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  };

  // Get BPMN loop characteristics (actual BPMN attributes)
  const getBPMNLoopCharacteristics = () => {
    // This would come from the original BPMN element data if available
    // For now, we don't have access to the original BPMN element here
    // This should be passed from the BPMN transformation if needed
    return null;
  };

  // Get flow traversal status for inline display
  const getFlowTraversalStatus = () => {
    if (element.isLoopCut) {
      return 'Flow cut off (depth limit)';
    }
    if (element.isLoop) {
      return 'Loop instance';
    }
    return null;
  };

  // Get comprehensive element type description
  const getFullElementType = (element: GanttElementType): string => {
    const baseType = element.type;
    const elementType = element.elementType;

    // Create full type description based on element type and elementType
    if (baseType === 'task') {
      if (elementType) {
        return elementType;
      }
      return 'Task';
    } else if (baseType === 'milestone') {
      if (elementType) {
        // Check if it's an event type
        if (
          elementType.includes('Start') ||
          elementType.includes('End') ||
          elementType.includes('Intermediate')
        ) {
          return `${elementType} Event`;
        }
        return `${elementType}`;
      }
      return 'Milestone';
    } else if (baseType === 'group') {
      return 'Group/Summary Task';
    }

    // Fallback
    return elementType || baseType || 'Unknown';
  };

  return (
    <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
      {/* Element Information */}
      <div style={{ marginBottom: '16px' }}>
        <div>
          <strong>Name:</strong> {element.name || <em style={{ color: '#999' }}>not set</em>}
        </div>
        <div>
          <strong>Type:</strong> {getFullElementType(element)}
          {getFlowTraversalStatus() && (
            <span
              style={{
                marginLeft: '8px',
                fontSize: '12px',
                color: '#f57c00',
                fontWeight: 'normal',
              }}
            >
              ({getFlowTraversalStatus()})
            </span>
          )}
        </div>
        <div>
          <strong>ID:</strong> {element.id}
        </div>
        {element.type !== 'group' && (
          <>
            <div>
              <strong>Start:</strong> {new Date(element.start).toLocaleString()}
            </div>
            <div>
              <strong>End:</strong> {new Date(element.end || element.start).toLocaleString()}
            </div>
            {element.end && element.start !== element.end && (
              <div>
                <strong>Duration:</strong> {formatDuration(element.start, element.end)}
              </div>
            )}
          </>
        )}
        {element.type === 'group' && element.childIds && (
          <>
            <div>
              <strong>Child Elements:</strong> {element.childIds.length}
            </div>
            {element.end && element.start !== element.end && (
              <div>
                <strong>Duration:</strong> {formatDuration(element.start, element.end)}
              </div>
            )}
          </>
        )}
      </div>

      {/* BPMN Loop Characteristics */}
      {getBPMNLoopCharacteristics() && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#1890ff' }}>BPMN Loop Characteristics</h4>
          <div>{getBPMNLoopCharacteristics()}</div>
        </div>
      )}

      {/* Dependencies */}
      {(incomingDeps.length > 0 || outgoingDeps.length > 0) && (
        <div style={{ marginBottom: '16px' }}>
          {/* Incoming Dependencies Section */}
          {incomingDeps.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 6px 0', color: '#666', fontSize: '14px', fontWeight: 600 }}>
                Incoming dependencies ({incomingDeps.length})
              </h4>
              {incomingDeps.map((dep) => {
                const sourceElement = elementMap.get(dep.sourceId);
                const displayName = sourceElement?.name ? (
                  sourceElement.name
                ) : (
                  <em style={{ color: '#999' }}>&lt;{dep.sourceId}&gt;</em>
                );
                return (
                  <div
                    key={dep.id}
                    style={{
                      padding: '4px 0 4px 12px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => onElementClick(dep.sourceId)}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9f9f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>{displayName}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      <em style={{ color: '#999' }}>&lt;{dep.id}&gt;</em>
                      {dep.flowType && dep.flowType !== 'normal' && (
                        <span style={{ marginLeft: '4px', color: '#1890ff' }}>
                          [{dep.flowType}]
                        </span>
                      )}
                      <span style={{ marginLeft: '8px', color: '#52c41a' }}>({dep.type})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Outgoing Dependencies Section */}
          {outgoingDeps.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#666', fontSize: '14px', fontWeight: 600 }}>
                Outgoing dependencies ({outgoingDeps.length})
              </h4>
              {outgoingDeps.map((dep) => {
                const targetElement = elementMap.get(dep.targetId);
                const displayName = targetElement?.name ? (
                  targetElement.name
                ) : (
                  <em style={{ color: '#999' }}>&lt;{dep.targetId}&gt;</em>
                );
                return (
                  <div
                    key={dep.id}
                    style={{
                      padding: '4px 0 4px 12px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => onElementClick(dep.targetId)}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9f9f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div>{displayName}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      <em style={{ color: '#999' }}>&lt;{dep.id}&gt;</em>
                      {dep.flowType && dep.flowType !== 'normal' && (
                        <span style={{ marginLeft: '4px', color: '#1890ff' }}>
                          [{dep.flowType}]
                        </span>
                      )}
                      <span style={{ marginLeft: '8px', color: '#52c41a' }}>({dep.type})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* No Dependencies Message */}
      {incomingDeps.length === 0 && outgoingDeps.length === 0 && (
        <div style={{ color: '#666', fontStyle: 'italic' }}>This element has no dependencies.</div>
      )}
    </div>
  );
};

/**
 * Canvas-based Gantt chart component with high-precision zoom and pan
 */
export const GanttChartCanvas = React.forwardRef<unknown, GanttChartCanvasProps>(
  (
    {
      elements,
      width = '100%',
      height = '100%',
      options = {},
      currentDateMarkerTime,
      dependencies = [],
      showInstanceColumn = false,
      showLoopColumn = false,
    },
    ref,
  ) => {
    // Create refs
    const rendererRef = useRef<CanvasRenderer | null>(null);
    const elementManagerRef = useRef<ElementManager | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const chartContentRef = useRef<HTMLDivElement>(null);
    const lastScrollTopRef = useRef<number>(0);

    // Track current time unit
    const [currentTimeUnit, setCurrentTimeUnit] = useState<string>('Day');

    // Track scroll position to trigger re-renders for virtualization
    const [scrollTop, setScrollTop] = useState(0);

    // Track selected element for highlighting dependencies
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    // Track info modal state
    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [infoModalElement, setInfoModalElement] = useState<GanttElementType | null>(null);

    // Function to get outgoing dependencies for highlighting
    const getOutgoingDependencies = useCallback(
      (elementId: string) => {
        return dependencies.filter((dep) => dep.sourceId === elementId);
      },
      [dependencies],
    );

    // Handle element selection
    const handleElementClick = useCallback((elementId: string) => {
      setSelectedElementId((prev) => (prev === elementId ? null : elementId));
    }, []);

    // Handle info button click
    const handleInfoClick = useCallback((element: GanttElementType, event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent bubbling to avoid double selection
      setSelectedElementId(element.id); // Select the row
      setInfoModalElement(element);
      setInfoModalVisible(true);
    }, []);

    // Handle modal close
    const handleModalClose = useCallback(() => {
      setInfoModalVisible(false);
      setInfoModalElement(null);
    }, []);

    // Calculate total height for virtualization
    // This is the full scrollable height based on the number of elements
    const totalContentHeight = elements.length * ROW_HEIGHT;

    // Use the Gantt chart hook
    const gantt = useGanttChart(elements, options);

    // Cache the time matrix to avoid recreating it on every render
    const timeMatrixRef = useRef<TimeMatrix>();

    // Main rendering function - optimized for performance
    const renderChart = useCallback(() => {
      if (!rendererRef.current || !gantt.chartCanvasRef.current) return;

      // Always ensure we know the current scroll position, even if no scroll event has fired yet
      // Get current scroll position from the actual scroll container
      const scrollPosition = gantt.taskListRef.current?.scrollTop || lastScrollTopRef.current || 0;

      // Update the ref with the current scroll position
      if (gantt.taskListRef.current?.scrollTop !== undefined) {
        lastScrollTopRef.current = gantt.taskListRef.current.scrollTop;
      }

      // Ensure chart container never scrolls
      if (chartContentRef.current && chartContentRef.current.scrollTop !== 0) {
        chartContentRef.current.scrollTop = 0;
      }

      // Get chart dimensions
      const chartWidth = gantt.chartCanvasRef.current.width / window.devicePixelRatio;

      // Only create a new matrix if zoom has changed or matrix doesn't exist
      // Create a zoom curve calculator instance for consistent scaling
      const zoomCurveCalculator = new ZoomCurveCalculator();

      // Calculate the current scale based on zoom level
      const currentScale = zoomCurveCalculator.calculateScale(gantt.state.zoom);

      // IMPORTANT: Use the matrix from gantt hook directly instead of creating our own
      // This ensures we use all the baseTime optimizations and other precision fixes
      if (gantt.timeMatrixRef && gantt.timeMatrixRef.current) {
        // Use the matrix directly from the hook
        timeMatrixRef.current = gantt.timeMatrixRef.current;
      }
      // Fallback only if no matrix is available from the hook (shouldn't happen)
      else if (!timeMatrixRef.current || timeMatrixRef.current.scale !== currentScale) {
        // Create new matrix with the calculated scale
        const newMatrix = new TimeMatrix(
          currentScale, // Use the consistent scaling from ZoomCurveCalculator
          0,
          gantt.state.visibleTimeStart, // Use visible start as the baseTime
        );

        // Calculate center point in time
        const centerTime = (gantt.state.visibleTimeStart + gantt.state.visibleTimeEnd) / 2;
        const centerPx = chartWidth / 2;

        // Adjust translation to center on visible time range
        const centerPxWithScale = newMatrix.transformPoint(centerTime);
        const translation = centerPx - centerPxWithScale;
        newMatrix.translate = translation;

        // Store for reuse
        timeMatrixRef.current = newMatrix;
      }

      const timeMatrix = timeMatrixRef.current;

      // Avoid rendering when container is not visible
      if (chartWidth > 0) {
        // Get exact scroll position with no rounding or modifications
        // This ensures perfect alignment between task list and chart
        const scrollTop = scrollPosition;

        // Get the visible height of the viewport (not the canvas height)
        const visibleHeight = chartContentRef.current ? chartContentRef.current.clientHeight : 500;

        // Add very generous padding to ensure we render elements well beyond the viewport
        // Using 20 rows of padding to prevent empty space when scrolling quickly
        const clientHeight = visibleHeight + ROW_HEIGHT * 20;

        // Calculate visible rows
        const visibleRowStart = Math.floor(scrollTop / ROW_HEIGHT);
        const visibleRowEnd = Math.ceil((scrollTop + clientHeight) / ROW_HEIGHT);

        // Render timeline with accurate dimensions
        const timelineContainer = gantt.timelineCanvasRef.current?.parentElement;
        if (timelineContainer && timelineContainer.clientWidth > 0) {
          // 50px height for timeline - optimized for two-line labels
          rendererRef.current.renderTimeline(timeMatrix, 50);
        }

        // Always use element manager for consistency
        if (elementManagerRef.current) {
          elementManagerRef.current.setElements(elements);
        }

        // Get highlighted dependencies for the selected element
        const highlightedDependencies = selectedElementId
          ? getOutgoingDependencies(selectedElementId)
          : [];

        // Always pass ALL elements to the renderer
        // The renderer will handle visibility filtering internally
        rendererRef.current.renderChartContent(
          timeMatrix,
          elements,
          visibleRowStart,
          visibleRowEnd,
          currentDateMarkerTime, // Pass the optional custom date marker time
          dependencies, // Pass dependency arrows
          scrollTop, // Pass exact scroll position
          highlightedDependencies, // Pass highlighted dependencies
          selectedElementId, // Pass selected element ID for row highlighting
          options?.curvedDependencies, // Pass curved dependencies setting
        );

        // Update current time unit from renderer (moved to separate effect to avoid infinite loop)
      }
    }, [
      elements,
      gantt.state.zoom,
      gantt.state.visibleTimeStart,
      gantt.state.visibleTimeEnd,
      gantt.chartCanvasRef,
      gantt.taskListRef,
      currentDateMarkerTime,
      dependencies,
      selectedElementId,
      getOutgoingDependencies,
    ]);

    // Update time unit display separately to avoid infinite loops
    useEffect(() => {
      if (rendererRef.current) {
        const timeUnit = rendererRef.current.getCurrentTimeUnit();
        if (timeUnit) {
          setCurrentTimeUnit(timeUnit.charAt(0).toUpperCase() + timeUnit.slice(1));
        }
      }
    }, [gantt.state.zoom]); // Only update when zoom changes, not during panning

    // Simple scroll handling with throttling
    const handleScroll = useCallback(
      (e: React.UIEvent<HTMLDivElement>) => {
        const newScrollTop = e.currentTarget.scrollTop;
        lastScrollTopRef.current = newScrollTop;

        // Update scroll state to trigger re-render for task list virtualization
        setScrollTop(newScrollTop);

        // Don't sync scroll to chart container - we handle it via canvas translation
        // Only update if this is the task list scrolling
        if (e.currentTarget === gantt.taskListRef.current) {
          // Just trigger a re-render with the new scroll position
          renderChart();
        }

        // Throttle rendering
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }

        animationFrameIdRef.current = requestAnimationFrame(() => {
          renderChart();
          animationFrameIdRef.current = null;
        });
      },
      [renderChart, gantt.taskListRef],
    );

    // Initialize the renderer when canvas refs are available
    useEffect(() => {
      if (!gantt.timelineCanvasRef.current || !gantt.chartCanvasRef.current) {
        return;
      }

      // Create canvas contexts
      const timelineCtx = gantt.timelineCanvasRef.current.getContext('2d');
      const chartCtx = gantt.chartCanvasRef.current.getContext('2d');

      if (!timelineCtx || !chartCtx) {
        return;
      }

      // Create renderer instance
      if (!rendererRef.current) {
        // Construct renderer config
        const rendererConfig: Partial<RendererConfig> = {
          taskBarHeight: Math.round(ROW_HEIGHT * 0.7),
          milestoneSize: Math.round(ROW_HEIGHT * 0.5),
          currentZoom: gantt.state.zoom, // Pass the current zoom level
          showLoopIcons: options.showLoopIcons ?? true, // Default to true if not provided
        };

        // Add grid configuration if provided
        if (options.grid) {
          // Set grid properties (excluding colors)
          rendererConfig.grid = {
            major: {
              lineWidth: options.grid.major?.lineWidth || 1,
              timelineTickSize: options.grid.major?.timelineTickSize ?? 10, // Default to 10px ticks
            },
            minor: {
              lineWidth: options.grid.minor?.lineWidth || 0.5,
              timelineTickSize: options.grid.minor?.timelineTickSize ?? 0, // Default to full height
            },
          };

          // Set grid colors if provided
          rendererConfig.colors = {
            grid: {
              major: options.grid.major?.color || '#C9C9C9', // Use default if not provided
              minor: options.grid.minor?.color || '#E8E8E8', // Use default if not provided
            },
            text: '#333333',
            background: '#FFFFFF',
            task: '#4F94F9',
            milestone: '#F05454',
          };
        }

        rendererRef.current = new CanvasRenderer(rendererConfig);
      }

      // Set up contexts
      rendererRef.current.setContext(
        CanvasLayerType.Timeline,
        timelineCtx,
        gantt.timelineCanvasRef.current.width / window.devicePixelRatio,
        gantt.timelineCanvasRef.current.height / window.devicePixelRatio,
      );

      rendererRef.current.setContext(
        CanvasLayerType.ChartContent,
        chartCtx,
        gantt.chartCanvasRef.current.width / window.devicePixelRatio,
        gantt.chartCanvasRef.current.height / window.devicePixelRatio,
      );

      // Create element manager
      elementManagerRef.current = new ElementManager();
      elementManagerRef.current.setElements(elements);
      elementManagerRef.current.setRowHeight();

      // Initial render
      renderChart();

      // Force a second render after a brief delay to ensure all grid lines are visible
      // This helps with the horizontal lines rendering issue
      setTimeout(() => {
        // Forces the horizontal line rendering even when scrolled to the top
        if (rendererRef.current) {
          // Reset rendering state to force horizontal line redraw
          rendererRef.current.updateConfig({
            // Reset row references to force redraw but keep all other settings
            _forceGridLineRedraw: true,
          });
        }
        renderChart();
      }, 50);

      // Set up resize observer
      const resizeObserver = new ResizeObserver(() => {
        // Ensure scroll alignment is maintained when resize happens
        // This is important for responsiveness when browser window size changes
        if (chartContentRef.current && gantt.taskListRef.current) {
          // Maintain scroll synchronization on resize
          const currentScroll = lastScrollTopRef.current;
          chartContentRef.current.scrollTop = currentScroll;
          gantt.taskListRef.current.scrollTop = currentScroll;
        }

        // Update canvas sizes
        if (gantt.timelineCanvasRef.current && gantt.chartCanvasRef.current) {
          const timelineContainer = gantt.timelineCanvasRef.current.parentElement;
          const chartContainer = gantt.chartCanvasRef.current.parentElement;

          if (timelineContainer && chartContainer) {
            // Update timeline canvas
            const timelineWidth = timelineContainer.clientWidth;
            const timelineHeight = timelineContainer.clientHeight;

            gantt.timelineCanvasRef.current.width = timelineWidth * window.devicePixelRatio;
            gantt.timelineCanvasRef.current.height = timelineHeight * window.devicePixelRatio;
            gantt.timelineCanvasRef.current.style.width = `${timelineWidth}px`;
            gantt.timelineCanvasRef.current.style.height = `${timelineHeight}px`;

            if (timelineCtx) {
              timelineCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }

            // Update chart canvas
            const chartWidth = chartContainer.clientWidth;
            // Calculate chart height as max of container height and content height
            // This ensures both proper viewport filling AND content scrolling
            const containerHeight = chartContainer.clientHeight || 500;
            const chartHeight = Math.max(containerHeight, totalContentHeight);

            // Keep container at viewport height since we handle scrolling via canvas translation
            chartContainer.style.minHeight = '100%';
            chartContainer.style.height = '100%';

            // Set canvas elements to use 100% height of their container
            gantt.chartCanvasRef.current.style.width = '100%';
            gantt.chartCanvasRef.current.style.height = '100%';

            // Set internal canvas dimensions based on the actual computed size
            const computedWidth = gantt.chartCanvasRef.current.offsetWidth;
            const computedHeight = gantt.chartCanvasRef.current.offsetHeight;
            gantt.chartCanvasRef.current.width = computedWidth * window.devicePixelRatio;
            gantt.chartCanvasRef.current.height = computedHeight * window.devicePixelRatio;

            if (chartCtx) {
              chartCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
            }

            // Resize renderer contexts
            if (rendererRef.current) {
              rendererRef.current.resizeLayer(
                CanvasLayerType.Timeline,
                timelineWidth,
                timelineHeight,
              );

              rendererRef.current.resizeLayer(
                CanvasLayerType.ChartContent,
                chartWidth,
                containerHeight,
              );
            }

            // Request a render
            renderChart();
          }
        }
      });

      // Observe containers
      if (gantt.containerRef.current) {
        resizeObserver.observe(gantt.containerRef.current);
      }

      // Clean up
      return () => {
        resizeObserver.disconnect();
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }
      };
    }, [gantt.timelineCanvasRef, gantt.chartCanvasRef, gantt.containerRef, elements, renderChart]);

    // Track previous configuration values to avoid unnecessary updates
    const prevConfigRef = useRef({
      zoom: gantt.state.zoom,
      showLoopIcons: options.showLoopIcons,
      gridMajorLineWidth: options.grid?.major?.lineWidth,
      gridMajorColor: options.grid?.major?.color,
      gridMajorTimelineTickSize: options.grid?.major?.timelineTickSize,
      gridMinorLineWidth: options.grid?.minor?.lineWidth,
      gridMinorColor: options.grid?.minor?.color,
      gridMinorTimelineTickSize: options.grid?.minor?.timelineTickSize,
    });

    // Update debug mode, zoom level, and grid settings when they change
    useEffect(() => {
      if (rendererRef.current) {
        // Check if any relevant configuration value has actually changed
        const hasConfigChanged =
          gantt.state.zoom !== prevConfigRef.current.zoom ||
          options.showLoopIcons !== prevConfigRef.current.showLoopIcons ||
          options.grid?.major?.lineWidth !== prevConfigRef.current.gridMajorLineWidth ||
          options.grid?.major?.color !== prevConfigRef.current.gridMajorColor ||
          options.grid?.major?.timelineTickSize !==
            prevConfigRef.current.gridMajorTimelineTickSize ||
          options.grid?.minor?.lineWidth !== prevConfigRef.current.gridMinorLineWidth ||
          options.grid?.minor?.color !== prevConfigRef.current.gridMinorColor ||
          options.grid?.minor?.timelineTickSize !== prevConfigRef.current.gridMinorTimelineTickSize;

        // Only update if configuration has actually changed
        if (hasConfigChanged) {
          // Create the update configuration
          const updateConfig: Partial<RendererConfig> = {
            currentZoom: gantt.state.zoom,
            showLoopIcons: options.showLoopIcons ?? true,
          };

          // Add grid configuration if provided
          if (options.grid) {
            // Add grid properties
            updateConfig.grid = {
              major: {
                lineWidth: options.grid.major?.lineWidth || 1,
                timelineTickSize: options.grid.major?.timelineTickSize ?? 10,
              },
              minor: {
                lineWidth: options.grid.minor?.lineWidth || 0.5,
                timelineTickSize: options.grid.minor?.timelineTickSize ?? 0,
              },
            };

            // Always pass color configuration to ensure consistent styling
            updateConfig.colors = {
              grid: {
                major: options.grid.major?.color || '#C9C9C9',
                minor: options.grid.minor?.color || '#E8E8E8',
              },
              text: '#333333',
              background: '#FFFFFF',
              task: '#4F94F9',
              milestone: '#F05454',
            };
          }

          // Apply the configuration update
          rendererRef.current.updateConfig(updateConfig);

          // Request a render to show updated settings immediately
          requestAnimationFrame(() => {
            renderChart();
          });

          // Update previous values
          prevConfigRef.current = {
            zoom: gantt.state.zoom,
            showLoopIcons: options.showLoopIcons,
            gridMajorLineWidth: options.grid?.major?.lineWidth,
            gridMajorColor: options.grid?.major?.color,
            gridMajorTimelineTickSize: options.grid?.major?.timelineTickSize,
            gridMinorLineWidth: options.grid?.minor?.lineWidth,
            gridMinorColor: options.grid?.minor?.color,
            gridMinorTimelineTickSize: options.grid?.minor?.timelineTickSize,
          };
        }
      }
    }, [
      gantt.state.zoom,
      renderChart,
      options.showLoopIcons,
      options.grid?.major?.color,
      options.grid?.major?.lineWidth,
      options.grid?.major?.timelineTickSize,
      options.grid?.minor?.color,
      options.grid?.minor?.lineWidth,
      options.grid?.minor?.timelineTickSize,
    ]);

    // Attach wheel event listener with passive: false option to allow preventDefault()
    useEffect(() => {
      const chartCanvas = gantt.chartCanvasRef.current;
      if (!chartCanvas) return;

      // Function to handle wheel events
      const handleWheelEvent = (e: WheelEvent) => {
        // Call the handler from the gantt hook
        gantt.handleWheel(e as any);
      };

      // Add event listener with { passive: false } to allow preventDefault()
      chartCanvas.addEventListener('wheel', handleWheelEvent, { passive: false });

      // Cleanup function
      return () => {
        chartCanvas.removeEventListener('wheel', handleWheelEvent);
      };
    }, [gantt.handleWheel, gantt.chartCanvasRef]);

    // Request render when zoom or time range changes
    useEffect(() => {
      if (!rendererRef.current) return;

      // Cancel any pending animation frame
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      animationFrameIdRef.current = requestAnimationFrame(() => {
        renderChart();
        animationFrameIdRef.current = null;
      });
    }, [gantt.state.zoom, gantt.state.visibleTimeStart, gantt.state.visibleTimeEnd, renderChart]);

    // Update canvas sizes whenever the container size or content height changes
    // This ensures the canvas adjusts to both viewport size and content
    useEffect(() => {
      if (gantt.chartCanvasRef.current && chartContentRef.current) {
        const chartWidth = chartContentRef.current.clientWidth;
        const viewportHeight = chartContentRef.current.clientHeight;
        const isLargeDataset = elements.length > 1000;

        // Calculate the appropriate canvas height:
        // 1. At minimum, it should fill the viewport
        // 2. For small datasets, it should accommodate all the content
        // 3. For large datasets, we cap height for performance while still showing all visible items
        let effectiveCanvasHeight;

        if (isLargeDataset) {
          // For large datasets, ensure canvas height is at least viewport height
          // but limit max height to 2x viewport or 5000px (whichever is smaller) for performance
          effectiveCanvasHeight = Math.max(
            viewportHeight,
            Math.min(5000, viewportHeight * 2, totalContentHeight),
          );
        } else {
          // For smaller datasets, use max of viewport height and content height
          effectiveCanvasHeight = Math.max(viewportHeight, totalContentHeight);
        }

        // Update the container size first
        const container = gantt.chartCanvasRef.current.parentElement;
        if (container) {
          container.style.height = `${effectiveCanvasHeight}px`;
        }

        // Update canvas to the new height
        gantt.chartCanvasRef.current.style.height = `100%`;

        // Set the internal canvas dimensions to match the full physical size
        // Use the computed size from the element itself after we've set it to 100%
        const actualCanvasWidth = gantt.chartCanvasRef.current.offsetWidth;
        const actualCanvasHeight = gantt.chartCanvasRef.current.offsetHeight;

        // Update internal dimensions with device pixel ratio
        gantt.chartCanvasRef.current.width = actualCanvasWidth * window.devicePixelRatio;
        gantt.chartCanvasRef.current.height = actualCanvasHeight * window.devicePixelRatio;

        // Also update renderer's context sizes if available
        if (rendererRef.current) {
          rendererRef.current.resizeLayer(
            CanvasLayerType.ChartContent,
            actualCanvasWidth,
            actualCanvasHeight,
          );
        }

        // Trigger a render with adaptive timing based on dataset size
        if (isLargeDataset) {
          // Use timeout for large datasets to avoid UI jank
          setTimeout(() => renderChart(), 50);
        } else {
          // Use requestAnimationFrame for smoother updates with smaller datasets
          requestAnimationFrame(() => renderChart());
        }
      }
    }, [totalContentHeight, renderChart, gantt.chartCanvasRef, elements.length, chartContentRef]);

    // Get panOffset for transforms
    const panOffset = gantt.state.panOffset || 0;

    return (
      <div
        ref={gantt.containerRef}
        className={styles.ganttContainer}
        style={{
          width: width,
          height: height || '100%',
          minHeight: '100%' /* Ensure the chart fills its container */,
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Controls Section */}
        {options.showControls !== false && (
          <div className={styles.ganttControls}>
            {/* Auto-fit Button */}
            <button
              className={styles.controlButton}
              onClick={() => gantt.handleAutoFit()}
              title="Fit to View"
            >
              Fit to View
            </button>

            {/* Zoom Out Button (minus) */}
            <button
              className={styles.controlButton}
              onClick={() => gantt.handleZoomChange(Math.round(Math.max(0, gantt.state.zoom - 5)))}
              title="Zoom Out"
            >
              −
            </button>

            {/* Zoom Slider */}
            <div className={styles.zoomSliderContainer}>
              <input
                type="range"
                className={styles.zoomSlider}
                min="0"
                max="100"
                value={gantt.state.zoom}
                onChange={(e) => gantt.handleZoomChange(Number(e.target.value))}
              />
            </div>

            {/* Zoom In Button (plus) */}
            <button
              className={styles.controlButton}
              onClick={() =>
                gantt.handleZoomChange(Math.round(Math.min(100, gantt.state.zoom + 5)))
              }
              title="Zoom In"
            >
              +
            </button>

            <span className={styles.zoomValue}>{Math.round(gantt.state.zoom)}%</span>

            {/* Time Unit Display */}
            <div className={styles.timeUnitDisplay}>
              Time Unit: <span className={styles.timeUnitValue}>{currentTimeUnit}</span>
            </div>
          </div>
        )}

        {/* Header Row with Task List Header and Timeline */}
        <div className={styles.headerRow}>
          {/* Task List Header */}
          <div className={styles.taskListHeader} style={{ width: gantt.state.taskListWidth }}>
            <div className={styles.taskListHeaderColumns}>
              <div className={styles.infoButtonColumn}></div>
              <div className={styles.taskNameColumn}>Task Name</div>
              <div className={styles.extraInfoColumn}>Type</div>
              {showInstanceColumn && <div className={styles.instanceColumn}>#</div>}
              {showLoopColumn && (
                <div
                  className={styles.loopStatusColumn}
                  title="Loop Status: ↻ = Loop Element, ✕ = Loop Cut Off"
                >
                  Loop
                </div>
              )}
            </div>
            {/* Resize Handle */}
            <div className={styles.resizeHandle} onMouseDown={gantt.handleResizeStart} />
          </div>

          {/* Timeline Header */}
          <div className={styles.timelineHeader}>
            <div
              style={{
                transform: `translateX(${panOffset}px)`,
                willChange: gantt.state.isDragging ? 'transform' : '',
                width: '500%', // 5x viewport width
                height: '100%',
                position: 'relative',
                left: '-200%', // Center the 5x canvas (2x on each side)
              }}
            >
              <canvas ref={gantt.timelineCanvasRef} className={styles.timelineCanvas} />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={styles.contentRow} style={{ flex: '1 1 auto', minHeight: 0 }}>
          {/* Task List */}
          <div
            ref={gantt.taskListRef}
            className={styles.taskList}
            style={{ width: gantt.state.taskListWidth }}
            onScroll={handleScroll}
          >
            {/* Task list content with true virtualization for large datasets */}
            <div style={{ position: 'relative', height: totalContentHeight + 'px' }}>
              {(() => {
                // Calculate visible elements for task list using state
                const clientHeight = gantt.taskListRef.current?.clientHeight || 500;

                // Only render elements that are visible or close to visible area
                const startIndex = Math.max(
                  0,
                  Math.floor((scrollTop - ROW_HEIGHT * 5) / ROW_HEIGHT),
                );
                const endIndex = Math.min(
                  elements.length - 1,
                  Math.ceil((scrollTop + clientHeight + ROW_HEIGHT * 5) / ROW_HEIGHT),
                );

                // For large datasets, consider more aggressive virtualization
                const isLargeDataset = elements.length > 1000;
                const buffer = isLargeDataset ? 10 : 20;

                const visibleStartIndex = Math.max(
                  0,
                  Math.floor((scrollTop - ROW_HEIGHT * buffer) / ROW_HEIGHT),
                );
                const visibleEndIndex = Math.min(
                  elements.length - 1,
                  Math.ceil((scrollTop + clientHeight + ROW_HEIGHT * buffer) / ROW_HEIGHT),
                );

                // Create array of visible elements only
                const visibleElements = [];
                for (let i = visibleStartIndex; i <= visibleEndIndex; i++) {
                  const element = elements[i];
                  if (!element) continue;

                  const isSelected = selectedElementId === element.id;

                  visibleElements.push(
                    <div
                      key={element.id}
                      className={`${styles.taskItem} ${element.type === 'group' ? styles.groupItem : ''} ${isSelected ? styles.selectedItem : ''}`}
                      style={{
                        height: `${ROW_HEIGHT}px`,
                        top: `${i * ROW_HEIGHT}px`,
                        backgroundColor: isSelected
                          ? 'rgba(24, 144, 255, 0.1)'
                          : element.type === 'group'
                            ? 'rgba(114, 46, 209, 0.1)'
                            : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleElementClick(element.id)}
                    >
                      <div className={styles.taskItemColumns}>
                        <div className={styles.infoButtonColumn}>
                          <Button
                            type="text"
                            size="small"
                            icon={<InfoCircleOutlined />}
                            onClick={(e) => handleInfoClick(element, e)}
                            style={{
                              color: '#666',
                              padding: '0',
                              minWidth: '24px',
                              height: '24px',
                            }}
                          />
                        </div>
                        <div className={styles.taskNameColumn}>
                          <span
                            style={{
                              fontWeight: element.type === 'group' ? 'bold' : 'normal',
                              fontStyle: element.name ? 'normal' : 'italic',
                            }}
                          >
                            {element.name || `<${element.id}>`}
                          </span>
                          {element.type === 'group' &&
                            element.childIds &&
                            Array.isArray(element.childIds) &&
                            element.childIds.length > 0 && (
                              <span style={{ fontSize: '0.8em', color: '#777', marginLeft: '4px' }}>
                                ({element.childIds.length} items)
                              </span>
                            )}
                        </div>
                        <div className={styles.extraInfoColumn}>{element.elementType || ''}</div>
                        {showInstanceColumn && (
                          <div className={styles.instanceColumn}>
                            {element.instanceNumber || ''}
                          </div>
                        )}
                        {showLoopColumn && (
                          <div
                            className={styles.loopStatusColumn}
                            title={
                              element.isLoopCut
                                ? 'Loop Cut Off: Flow traversal was stopped at this element due to loop depth limits'
                                : element.isLoop
                                  ? 'Loop Element: This element is part of a loop flow'
                                  : 'Regular Element: Not part of any loop'
                            }
                          >
                            {element.isLoopCut ? '✕' : element.isLoop ? '↻' : ''}
                          </div>
                        )}
                      </div>
                    </div>,
                  );
                }

                return visibleElements;
              })()}
            </div>
          </div>

          {/* Chart Area */}
          <div
            className={styles.chartArea}
            style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {/* Chart Content */}
            <div
              ref={chartContentRef}
              className={styles.chartContentContainer}
              style={{
                flex: '1 1 auto',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
              // No scroll handler - chart doesn't scroll, only canvas translates
            >
              {/* Wrap the canvases in a container - viewport height only */}
              <div
                className={styles.canvasContainer}
                style={{
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Transform wrapper for panning */}
                <div
                  style={{
                    transform: `translateX(${panOffset}px)`,
                    willChange: gantt.state.isDragging ? 'transform' : '',
                    width: '500%', // 5x viewport width
                    height: '100%',
                    position: 'relative',
                    left: '-200%', // Center the 5x canvas (2x on each side)
                  }}
                >
                  {/* Main Chart Canvas - sized to match the full content height */}
                  <canvas
                    ref={gantt.chartCanvasRef}
                    className={styles.chartCanvas}
                    onMouseDown={gantt.handleMouseDown}
                    style={{
                      height: '100%',
                      minHeight: '100%',
                      width: '100%',
                      pointerEvents: 'auto',
                    }}
                  />
                </div>
              </div>

              {/* Virtual scroll content */}
              <div
                className={styles.virtualScrollContent}
                style={{ height: totalContentHeight + 'px', minHeight: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Element Info Modal */}
        <Modal
          title={infoModalElement?.name || infoModalElement?.id || 'Unknown'}
          open={infoModalVisible}
          onCancel={handleModalClose}
          footer={null}
          width={600}
        >
          {infoModalElement && (
            <ElementInfoContent
              element={infoModalElement}
              dependencies={dependencies}
              elements={elements}
              onElementClick={(elementId) => {
                const element = elements.find((el) => el.id === elementId);
                if (element) {
                  setInfoModalElement(element);
                  setSelectedElementId(elementId);
                }
              }}
            />
          )}
        </Modal>
      </div>
    );
  },
);

// Set display name for debugging
GanttChartCanvas.displayName = 'GanttChartCanvas';
