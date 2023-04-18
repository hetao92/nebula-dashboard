import React from 'react';
import Detail from '.';
import { SUPPORT_METRICS } from '@/utils/promQL';
import { getMetricsUniqName } from '@/utils/dashboard';
import { MetricScene } from '@/utils/interface';

export default () => (
  <Detail 
    // @ts-ignore
    type="disk"
    metricOptions={SUPPORT_METRICS.disk}
    dataTypeObj={getMetricsUniqName(MetricScene.DISK)}
  />
);
