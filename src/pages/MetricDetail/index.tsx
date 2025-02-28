import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import intl from 'react-intl-universal';

import MetricsFilterPanel from '@/components/MetricsFilterPanel';
import ServiceMetricsFilterPanel from '@/components/ServiceMetricsFilterPanel';
import { IDispatch, IRootState } from '@/store';

import styles from './index.module.less';
import LineChart from '@/components/Charts/LineChart';
import { useParams } from 'react-router-dom';
import { AggregationType, calcTimeRange, getBaseLineByUnit, getDataByType, getDiskData, getMetricsUniqName, getProperStep, getProperTickInterval, getTickIntervalByGap } from '@/utils/dashboard';
import { IServiceMetricItem, MetricScene, ServiceName } from '@/utils/interface';
import { SUPPORT_METRICS } from '@/utils/promQL';
import { shouldCheckCluster } from '@/utils';
import { Popover, Select, Spin } from 'antd';
import Icon from '@/components/Icon';
import BaseLineEditModal from '@/components/BaseLineEditModal';
import { getQueryByMetricType, isLatencyMetric } from '@/utils/metric';

interface Props
  extends ReturnType<typeof mapDispatch>,
  ReturnType<typeof mapState> {
  type:string
}

enum MetricTypeName {
  Disk = 'disk',
  Cpu = 'cpu',
  Memory = 'memory',
  Load = 'load',
  Network = 'network',
  Graphd = 'graphd',
  Metad = 'metad',
  Storaged = 'storaged'
}

function isServiceMetric(metricType: MetricTypeName) {
  return [MetricTypeName.Metad, MetricTypeName.Storaged, MetricTypeName.Graphd,
  ServiceName.MetadListener, ServiceName.StoragedListener,
  ServiceName.Drainer].includes(metricType);
}

function getMetricSecene(metricType: MetricTypeName) {
  switch (metricType) {
    case MetricTypeName.Disk:
      return MetricScene.DISK;
    case MetricTypeName.Cpu:
      return MetricScene.CPU;
    case MetricTypeName.Memory:
      return MetricScene.MEMORY;
    case MetricTypeName.Load:
      return MetricScene.LOAD;
    case MetricTypeName.Network:
      return MetricScene.NETWORK;
    default:
      return MetricScene.SERVICE;
  }
}

const mapState = (state: IRootState) => ({
  aliasConfig: state.app.aliasConfig,
  cluster: (state as any).cluster?.cluster,
  serviceMetric: state.serviceMetric,
  instances: state.machine.instanceList,
  serviceInstanceList: state.service.instanceList,
  metricsFilterValues: state.machine.metricsFilterValues,
  serviceMetricsFilterValues: state.service.metricsFilterValues,
  serviceLoading: state.loading.models.service,
  machineLoading: state.loading.models.machine,
});

const mapDispatch = (dispatch: IDispatch) => ({
  updateMetricsFiltervalues: dispatch.machine.updateMetricsFiltervalues,
  updateServiceMetricsFiltervalues: dispatch.service.updateMetricsFiltervalues,
  asyncFetchMachineMetricsData: dispatch.machine.asyncGetMetricsData,
  asyncFetchServiceMetricsData: dispatch.service.asyncGetMetricsData,
  asyncGetSpaces: dispatch.serviceMetric.asyncGetSpaces,
});

let pollingTimer: any;

function MetricDetail(props: Props) {

  const { cluster, type, metricsFilterValues, serviceMetricsFilterValues,
    updateMetricsFiltervalues, updateServiceMetricsFiltervalues, instances, serviceInstanceList,
    asyncFetchMachineMetricsData, aliasConfig, serviceMetric, asyncFetchServiceMetricsData, asyncGetSpaces,
    serviceLoading, machineLoading } = props;

  const { metricName, metricType } = useParams<any>();

  const [dataSource, setDataSource] = useState<any[]>([]);

  const [showLoading, setShowLoading] = useState<boolean>(false);

  const curMetricsFilterValues = useMemo(() => isServiceMetric(metricType) ? serviceMetricsFilterValues : metricsFilterValues, [type, metricsFilterValues, serviceMetricsFilterValues]);

  const metricOption = useMemo(() => {
    let metrics: any[] = [];
    if (isServiceMetric(metricType)) {
      metrics = serviceMetric[metricType];
    } else {
      metrics = SUPPORT_METRICS[metricType];
    }
    const metricItem = metrics.find(item => item.metric === metricName) || {
      metric: '',
      valueType: '',
      metricType: [],
      aggregations: [],
    }
    return metricItem
  }, [metricName, metricType, serviceMetric])

  useEffect(() => {
    if (isServiceMetric(metricType)) {
      setShowLoading(serviceLoading && curMetricsFilterValues.frequency === 0)
    } else {
      setShowLoading(machineLoading && curMetricsFilterValues.frequency === 0)
    }
  }, [metricType, serviceLoading, machineLoading, curMetricsFilterValues.frequency]);

  const metricChartRef = useRef<any>();

  const metricChart: any = useMemo(() => {
    if (metricChartRef.current) {
      const res = {
        ...metricChartRef.current,
        metric: metricOption,
      }
      return res
    }
    const res = {
      metric: metricOption,
      baseLine: undefined,
    }
    metricChartRef.current = res;
    return res
  }, [metricOption]);

  useEffect(() => {
    if (!isServiceMetric(metricType)) return;
    const [start, end] = calcTimeRange(curMetricsFilterValues.timeRange);
    if (shouldCheckCluster()) {
      if (cluster?.id) {
        asyncGetSpaces({
          clusterID: cluster.id,
          start,
          end
        })
      }
    } else {
      asyncGetSpaces({
        start,
        end
      })
    }
  }, [curMetricsFilterValues.timeRange, cluster, metricType])

  useEffect(() => {
    if (pollingTimer) {
      clearTimeout(pollingTimer);
    }
    if (shouldCheckCluster()) {
      if (cluster?.id) {
        pollingData();
      }
    } else {
      pollingData();
    }
  }, [cluster, curMetricsFilterValues.frequency, curMetricsFilterValues.timeRange,
    curMetricsFilterValues.metricType, curMetricsFilterValues.period, curMetricsFilterValues.space, metricOption]);

  const pollingData = () => {
    getData();
    if (curMetricsFilterValues.frequency > 0) {
      pollingTimer = setTimeout(pollingData, curMetricsFilterValues.frequency);
    }
  };

  useEffect(() => {
    updateChart();
  }, [curMetricsFilterValues.instanceList, dataSource])

  const updateChart = () => {
    const metricScene = getMetricSecene(metricType);
    const instanceList = isServiceMetric(metricType) ? serviceInstanceList : instances;
    const data = metricType === MetricTypeName.Disk ?
      getDiskData({
        data: dataSource || [],
        type: curMetricsFilterValues.instanceList,
        nameObj: getMetricsUniqName(metricScene),
        aliasConfig,
        instanceList
      }) :
      getDataByType({
        data: dataSource || [],
        type: curMetricsFilterValues.instanceList,
        nameObj: getMetricsUniqName(metricScene),
        aliasConfig,
        instanceList,
      });
    const values = data.map(d => d.value) as number[];
    const maxNum = values.length > 0 ? Math.floor(Math.max(...values) * 100) / 100 : undefined;
    const minNum = values.length > 0 ? Math.floor(Math.min(...values) * 100) / 100 : undefined;
    const realRange = data.length > 0 ? (data[data.length - 1].time - data[0].time) : 0;
    let tickInterval = getTickIntervalByGap(Math.floor(realRange / 10)); // 10 ticks max
    metricChart.chartRef.updateDetailChart({
      type,
      tickInterval,
      valueType: metricChart.metric.valueType,
      maxNum,
      minNum,
    }).changeData(data);
  };

  const getData = async () => {
    const [startTimestamps, endTimestamps] = calcTimeRange(curMetricsFilterValues.timeRange);
    
    if (isServiceMetric(metricType)) {
      const { space } = curMetricsFilterValues;
      if (metricChart.metric.metric.length) {
        const aggregation = metricChart.metric.aggregations[0];
        asyncFetchServiceMetricsData({
          query: getQueryByMetricType(metricChart.metric, aggregation, '5'),
          start: startTimestamps,
          end: endTimestamps,
          space: metricType === MetricTypeName.Graphd ? space : undefined,
          clusterID: cluster?.id,
          aggregation,
        }).then(res => {
          setDataSource(res);
        });
      }
    } else {
      asyncFetchMachineMetricsData({
        start: startTimestamps,
        end: endTimestamps,
        metric: metricChart.metric.metric,
        clusterID: cluster?.id,
      }).then(res => {
        setDataSource(res);
      });
    }
  };

  const handleMetricChange = async values => {
    if (isServiceMetric(metricType)) {
      updateServiceMetricsFiltervalues(values)
    } else {
      updateMetricsFiltervalues(values);
    }
  };

  const handleRefresh = () => {
    if (isServiceMetric(metricType)) {
      setShowLoading(!!serviceLoading);
    } else {
      setShowLoading(!!machineLoading);
    }
    getData();
  }

  const renderChart = () => {
    const [startTimestamps, endTimestamps] = calcTimeRange(curMetricsFilterValues.timeRange);
    metricChart.chartRef.configDetailChart({
      tickInterval: getProperTickInterval(endTimestamps - startTimestamps),
      valueType: metricChart.metric.valueType,
    });
  }

  const handleBaseLineEdit = () => {
    BaseLineEditModal.show({
      baseLine: metricChart.baseLine,
      valueType: metricChart.metric.valueType,
      onOk: (values) => handleBaseLineChange(metricChart, values),
    });
  };

  const handleBaseLineChange = async (metricChart, values) => {
    const { baseLine, unit } = values;
    metricChart.baseLine = getBaseLineByUnit({
      baseLine,
      unit,
      valueType: metricChart.valueType,
    });
    metricChart.chartRef.updateBaseline(metricChart.baseLine);
  };

  const handleMetricAggChange = (metricChart: any) => (value: string) => {
    const [metric, agg] = value.split('$$');
    metricChart.metric = {
      ...metricChart.metric,
      metric,
      aggregations: [agg as AggregationType],
    }
    getData();
    // asyncGetMetricsData(true, [metricChart]);
  }

  const renderChartTitle = (metricItem: IServiceMetricItem, metricChart: any) => {
    if (isLatencyMetric(metricItem.metric)) {
      const metrics = [AggregationType.Avg, AggregationType.P99, AggregationType.P95].map(agg => ({
        ...metricItem,
        metric: `${metricItem.metric}$$${agg}`,
        aggregations: [agg]
      }))
      return (
        <div className='chart-title'>
          <Select
            bordered={false}
            value={metricItem.metric + '$$' + metricItem.aggregations[0]}
            onChange={handleMetricAggChange(metricChart)}
          >
            {
              metrics.map(metric => (
                <Select.Option key={metric.metric} value={metric.metric}>
                  <div className={styles.chartTitleOption}>
                    <span title={metric.metric.replaceAll('$$', '_')} style={{ fontWeight: 'bold' }}>{metric.metric.replaceAll('$$', '_')}</span>
                    <Popover
                      className={"chart-title-popover"}
                      content={
                        <div>{intl.get(`metric_description.${metricItem.metric}`)}</div>
                      }
                    >
                      <Icon className="metric-info-icon blue chart-title-desc" icon="#iconnav-serverInfo" />
                    </Popover>
                  </div>
                </Select.Option>
              ))
            }
          </Select>
        </div>
      )
    }
    return (
      <div className='chart-title'>
        <span title={metricItem.metric}>{metricItem.metric}</span>
        <Popover
          className={"chart-title-popover"}
          content={
            <div>{intl.get(`metric_description.${metricChart.metric?.metric}`)}</div>
          }
        >
          <Icon className="metric-info-icon blue chart-title-desc" icon="#iconnav-serverInfo" />
        </Popover>
      </div>
    )
  }

  return (
    <Spin spinning={showLoading}>
      <div className={styles.dashboardDetail}>
        <div className={styles.commonHeader}>
          {
            isServiceMetric(metricType) ? (
              <ServiceMetricsFilterPanel
                onChange={handleMetricChange}
                instanceList={serviceInstanceList}
                spaces={metricType === MetricTypeName.Graphd ? serviceMetric.spaces : undefined}
                values={curMetricsFilterValues}
                onRefresh={handleRefresh}
              />
            ) : (
              <MetricsFilterPanel
                onChange={handleMetricChange}
                instanceList={instances}
                values={curMetricsFilterValues}
                onRefresh={handleRefresh}
              />
            )
          }
        </div>
        <div className={styles.detailContent}>
          <div className={styles.chartItem}>
            {
              renderChartTitle(metricChart.metric, metricChart)
            }
            <div className={styles.chartContent}>
              <LineChart
                // options={{ padding: [10, 70, 70, 70] }}
                ref={ref => metricChart.chartRef = ref}
                renderChart={renderChart}
              />
            </div>
            <div className="action-icons">
              <div
                className="btn-icon-with-desc blue base-line"
                onClick={handleBaseLineEdit}
              >
                <Icon icon="#iconSet_up" />
                <span>{intl.get('common.baseLine')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Spin>
  )
}

export default connect(mapState, mapDispatch as any)(MetricDetail);