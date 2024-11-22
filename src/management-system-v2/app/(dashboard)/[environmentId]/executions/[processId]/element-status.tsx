import { ReactNode } from 'react';
import { Alert, Checkbox, Image, Progress, ProgressProps, Space, Typography } from 'antd';
import { ClockCircleFilled } from '@ant-design/icons';
import React from 'react';
import { statusToType } from './instance-helpers';
import { convertISODurationToMiliseconds, getMetaDataFromElement } from '@proceed/bpmn-helper';
import { generateRequestUrl } from '@/lib/engines/endpoints';
import { DisplayTable, RelevantInstanceInfo } from './instance-info-panel';

function transformMilisecondsToTimeFormat(milliseconds: number | undefined) {
  if (!milliseconds || milliseconds < 0 || milliseconds < 1000) return;

  const days = Math.floor(milliseconds / (3600000 * 24));
  milliseconds -= days * (3600000 * 24);
  const hours = Math.floor(milliseconds / 3600000);
  milliseconds -= hours * 3600000;
  // Minutes part from the difference
  const minutes = Math.floor(milliseconds / 60000);
  milliseconds -= minutes * 60000;
  //Seconds part from the difference
  const seconds = Math.floor(milliseconds / 1000);
  milliseconds -= seconds * 1000;

  // Will display time in 10:30:23 format
  return `${days} Days, ${hours}h, ${minutes}min, ${seconds}s`;
}

export function ElementStatus({ info }: { info: RelevantInstanceInfo }) {
  const statusEntries: ReactNode[][] = [];

  const isRootElement = info.element && info.element.type === 'bpmn:Process';
  const metaData = getMetaDataFromElement(info.element.businessObject);
  const token = info.instance?.tokens.find((l) => l.currentFlowElementId == info.element.id);
  const logInfo = info.instance?.log.find((logEntry) => logEntry.flowElementId === info.element.id);

  // Element image
  if (metaData.overviewImage)
    statusEntries.push([
      'Image',
      <div
        style={{
          width: '75%',
          display: 'flex',
          justifyContent: 'center',
          margin: 'auto',
          marginTop: '1rem',
        }}
      >
        <Image
          src={generateRequestUrl(
            { id: '', ip: 'localhost', port: 33029 },
            `/resources/process/${info.process.definitionId}/images/${metaData.overviewImage}`,
          )}
        />
      </div>,
    ]);

  // Element status
  let status = undefined;
  if (isRootElement && info.instance) {
    status = info.instance.instanceState[0];
  } else if (info.element && info.instance) {
    const elementInfo = info.instance.log.find((l) => l.flowElementId == info.element.id);
    if (elementInfo) {
      status = elementInfo.executionState;
    } else {
      const tokenInfo = info.instance.tokens.find((l) => l.currentFlowElementId == info.element.id);
      status = tokenInfo ? tokenInfo.currentFlowNodeState : 'WAITING';
    }
  }
  const statusType = status && statusToType(status);

  statusEntries.push([
    'Current state:',
    status && statusType && <Alert type={statusType} message={status} showIcon />,
  ]);

  // from ./src/management-system/src/frontend/components/deployments/activityInfo/ActivityStatusInformation.vue
  // TODO: Editable state?

  // Is External
  if (!isRootElement) {
    statusEntries.push([
      'External:',
      <Checkbox
        disabled
        value={info.element.businessObject && info.element.businessObject.external}
      />,
    ]);
  }

  // Progress
  // TODO: editable progress
  // see src/management-system/src/frontend/components/deployments/activityInfo/ProgressSetter.vue
  if (info.instance && !isRootElement) {
    let progress:
      | { value: number; manual: boolean; milestoneCalculatedProgress?: number }
      | undefined = undefined;
    if (token && token.currentFlowNodeProgress) {
      let milestoneCalculatedProgress = 0;
      if (token.milestones && Object.keys(token.milestones).length > 0) {
        const milestoneProgressValues = Object.values(token.milestones);
        milestoneCalculatedProgress =
          milestoneProgressValues.reduce((acc, milestoneVal) => acc + milestoneVal) /
          milestoneProgressValues.length;
      }

      progress = {
        ...token.currentFlowNodeProgress,
        milestoneCalculatedProgress,
      };
    } else if (logInfo?.progress) {
      progress = logInfo.progress;
    }

    if (progress) {
      let progressStatus: ProgressProps['status'] = 'normal';
      if (statusType === 'success') progressStatus = 'success';
      else if (statusType === 'error') progressStatus = 'exception';

      statusEntries.push([
        'Progress',
        <Progress percent={progress.value} status={progressStatus} />,
      ]);
    }
  }

  // User task
  // TODO: editable priority
  if (info.element.type === 'bpmn:UserTask') {
    let priority: number | undefined = undefined;

    if (info.instance) {
      if (token) priority = token.priority;
      else if (logInfo) priority = logInfo.priority;
    } else {
      priority = metaData['defaultPriority'];
    }

    statusEntries.push(['Priority:', priority]);
  }

  // Planned costs
  // TODO: Costs currency
  statusEntries.push(['Planned Costs:', metaData['costsPlanned']]);

  // Real Costs
  // TODO: Set real costs
  if (info.instance && !isRootElement) {
    let costs: string | undefined = undefined;
    if (token) costs = token.costsRealSetByOwner;
    else if (logInfo) costs = logInfo.costsRealSetByOwner;

    statusEntries.push(['Real Costs:', costs]);
  }

  // Documentation
  statusEntries.push(['Documentation:', info.element.businessObject?.documentation?.[0]?.text]);

  // Activity time calculation
  let start: Date | undefined = undefined;
  if (info.instance) {
    if (isRootElement) start = new Date(info.instance.globalStartTime);
    else if (logInfo) start = new Date(logInfo.startTime);
    else if (token) start = new Date(token.currentFlowElementStartTime);
  }

  let end;
  if (info.instance) {
    if (isRootElement) {
      const ended = info.instance.instanceState.every(
        (state) =>
          state !== 'RUNNING' &&
          state !== 'READY' &&
          state !== 'DEPLOYMENT-WAITING' &&
          state !== 'PAUSING' &&
          state !== 'PAUSED',
      );

      if (ended) {
        const lastLog = info.instance.log[info.instance.log.length - 1];
        if (lastLog) end = new Date(lastLog.endTime);
      }
    } else if (logInfo) {
      end = new Date(logInfo.endTime);
    }
  }

  let duration;
  if (start && end) duration = end.getTime() - start.getTime();

  const plan = {
    end: metaData.timePlannedEnd ? new Date(metaData.timePlannedEnd) : undefined,
    start: metaData.timePlannedOccurrence ? new Date(metaData.timePlannedOccurrence) : undefined,
    duration: metaData.timePlannedDuration
      ? convertISODurationToMiliseconds(metaData.timePlannedDuration)
      : undefined,
  };

  // The order in which missing times are derived from the others is irrelevant
  // If there is only one -> not possible to derive the others
  // If there are two -> derive the missing one (order doesn't matter)
  // If there are three -> nothing to do

  if (!plan.end && plan.start && plan.duration)
    plan.end = new Date(plan.start.getTime() + plan.duration);

  if (!plan.start && plan.end && plan.duration)
    plan.start = new Date(plan.end.getTime() - plan.duration);

  if (!plan.duration && plan.start && plan.end)
    plan.duration = plan.end.getTime() - plan.start.getTime();

  const delays = {
    start: plan.start && start && start.getTime() - plan.start.getTime(),
    end: plan.end && end && end.getTime() - plan.end.getTime(),
    duration: plan.duration && duration && duration - plan.duration,
  };

  // Activity time
  statusEntries.push([
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Started:</Typography.Text>
      <Typography.Text>{start?.toLocaleString()}</Typography.Text>
    </Space>,
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Planned Start:</Typography.Text>
      <Typography.Text>{plan.start?.toLocaleString() || ''}</Typography.Text>
    </Space>,
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Delay:</Typography.Text>
      <Typography.Text type={delays.start && delays.start >= 1000 ? 'danger' : undefined}>
        {transformMilisecondsToTimeFormat(delays.start)}
      </Typography.Text>
    </Space>,
  ]);

  statusEntries.push([
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Duration:</Typography.Text>
      <Typography.Text>{transformMilisecondsToTimeFormat(duration)}</Typography.Text>
    </Space>,
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Planned Duration:</Typography.Text>
      <Typography.Text>{transformMilisecondsToTimeFormat(plan.duration)}</Typography.Text>
    </Space>,
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Delay:</Typography.Text>
      <Typography.Text type={delays.duration && delays.duration >= 1000 ? 'danger' : undefined}>
        {delays.start ? transformMilisecondsToTimeFormat(delays.duration) : ''}
      </Typography.Text>
    </Space>,
  ]);

  statusEntries.push([
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Ended:</Typography.Text>
      <Typography.Text>{end?.toLocaleString()}</Typography.Text>
    </Space>,
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Planned End:</Typography.Text>
      <Typography.Text>{plan.end?.toLocaleString() || ''}</Typography.Text>
    </Space>,
    <Space>
      <ClockCircleFilled style={{ fontSize: '1rem' }} />
      <Typography.Text strong>Delay:</Typography.Text>
      <Typography.Text type={delays.end && delays.end >= 1000 ? 'danger' : undefined}>
        {transformMilisecondsToTimeFormat(delays.end)}
      </Typography.Text>
    </Space>,
  ]);

  return <DisplayTable data={statusEntries} />;
}
