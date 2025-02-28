import _ from 'loadsh';

import { VALUE_TYPE } from '@/utils/promQL';
import { INTERVAL_FREQUENCY_LIST, SERVICE_QUERY_PERIOD } from './service';
import { AggregationType, AGGREGATION_OPTIONS, getAutoLatency, getProperByteDesc, getProperStep, TIME_OPTION_TYPE } from './dashboard';
import { IServiceMetricItem, ServiceName } from './interface';
import dayjs from 'dayjs';

export const METRICS_DESCRIPTION: any = {
  num_queries: 'num_queries description',
  num_slow_queries: 'num_slow_queries description',
  query_latency_us: 'query_latency_us description',
  slow_query_latency_us: 'slow_query_latency_us description',
  num_query_errors: 'num_query_errors description',
  add_edges_atomic_latency_us: 'add_edges_atomic_latency_us description',
  add_edges_latency_us: 'add_edges_latency_us description',
  add_vertices_latency_us: 'add_vertices_latency_us description',
  delete_edges_latency_us: 'delete_edges_latency_us description',
  delete_vertices_latency_us: 'delete_vertices_latency_us description',
  forward_tranx_latency_us: 'forward_tranx_latency_us description',
  get_neighbors_latency_us: 'get_neighbors_latency_us description',
  heartbeat_latency_us: 'heartbeat_latency_us description',
  num_heartbeats: 'num_heartbeats description',
};

export const METRIC_FUNCTIONS: AggregationType[] = Object.values(AggregationType);

export const FILTER_METRICS = [
  // <= v2.5.1
  'get_prop_latency_us',
  'get_value_latency_us',
  'lookup_latency_us',
  'num_add_edges_atomic_errors',
  'num_add_edges_atomic',
  'num_add_edges_errors',
  'num_add_edges',
  'num_add_vertices_errors',
  'num_add_vertices',
  'num_delete_edges_errors',
  'num_delete_edges',
  'num_delete_vertices_errors',
  'num_delete_vertices',
  'num_forward_tranx_errors',
  'num_forward_tranx',
  'num_get_neighbors_errors',
  'num_get_neighbors',
  'num_get_prop_errors',
  'num_get_prop',
  'num_get_value_errors',
  'num_get_value',
  'num_lookup_errors',
  'num_lookup',
  'num_scan_edge_errors',
  'num_scan_edge',
  'num_scan_vertex_errors',
  'num_scan_vertex',
  'num_update_edge_errors',
  'num_update_edge',
  'num_update_vertex_errors',
  'num_update_vertex',
  'scan_edge_latency_us',
  'scan_vertex_latency_us',
  'update_edge_latency_us',
  'update_vertex_latency_us',
  // <= v2.6.1
  'num_delete_tags_errors',
  'num_delete_tags',
  'delete_tags_latency_us',
  // =3.0.0
  'num_kv_get_errors',
  'num_kv_get',
  'num_kv_put_errors',
  'num_kv_put',
  'num_kv_remove_errors',
  'num_kv_remove',
  'kv_get_latency_us',
  'kv_put_latency_us',
  'kv_remove_latency_us',
  'num_agent_heartbeats',
  'agent_heartbeat_latency_us',
  'num_auth_failed_sessions_out_of_max_allowed',
];

export const METRIC_PROCESS_TYPES = [
  ServiceName.GRAPHD,
  ServiceName.STORAGED,
  ServiceName.METAD,
] as const;

export const DEPENDENCY_PROCESS_TYPES = [
  ServiceName.MetadListener,
  ServiceName.StoragedListener,
  ServiceName.Drainer,
];

export const ClusterServiceNameMap = {
  [ServiceName.MetadListener]: 'metadListener',
  [ServiceName.StoragedListener]: 'storagedListener',
  [ServiceName.Drainer]: 'drainerd',
}

export const calcMetricInfo = (rawMetric: string) => {
  if (METRIC_FUNCTIONS.some(fn => rawMetric.includes(fn))) {
    const metricFieldArr = rawMetric.split(`_`);
    const key: AggregationType = metricFieldArr?.splice(-2, 2)[0] as AggregationType; // sum / avg / p99 ~
    const metricValue = metricFieldArr.join('_'); // nebula_graphd_num_queries
    return { key, metricValue }
  } else {
    return { metricValue: rawMetric }
  }
}

const calcServiceMetricValueType = (metricName: string): VALUE_TYPE => {
  if (metricName.includes('num')) {
    return VALUE_TYPE.number;
  }
  if (metricName.includes('latency')) {
    return VALUE_TYPE.latency;
  }
  if (metricName.includes('bytes')) {
    return VALUE_TYPE.byte;
  }
  if (metricName.includes('cpu_seconds')) {
    return VALUE_TYPE.percentage;
  }
  if (metricName.includes('seconds')) {
    return VALUE_TYPE.byteSecond;
  }
  return VALUE_TYPE.number;
}

export const filterServiceMetrics = (payload: {
  metricList: string[];
  spaceMetricList: string[];
  version?: string;
  componentType: string;
}) => {
  const { metricList, spaceMetricList = [], componentType } = payload;
  const metrics: IServiceMetricItem[] = [];
  metricList.map(item => {
    const [metricFieldType, metricFields] = item.split(`_${componentType.replace('-', '_')}_`); // Example: nebula_graphd_num_queries_sum_60 =>  nebula, num_queries_sum_60
    if (metricFieldType && metricFields) {
      const { key, metricValue } = calcMetricInfo(metricFields)
      const metricItem = _.find(metrics, m => m.metric === metricValue);
      if (_.includes(FILTER_METRICS, metricValue)) {
        // is filter metric
        return;
      }
      const isSpaceMetric = _.findLast(spaceMetricList, metric =>
        metric.includes(metricValue),
      );
      // push data into metrics
      if (metricItem) {
        if (key) {
          const metricTypeItem = _.find(
            metricItem.aggregations,
            _item => _item === key,
          );
          if (!metricTypeItem) {
            if (key === 'sum') {// make sum the first
              metricItem.aggregations.unshift(key);
              return;
            }
            metricItem.aggregations.push(key);
          }
        }
      } else {
        metrics.push({
          metric: metricValue,
          valueType: calcServiceMetricValueType(metricValue),
          isSpaceMetric: !!isSpaceMetric,
          isRawMetric: !key, // if metrics don't have sum / avg / p99 
          prefixMetric: `${metricFieldType}_${componentType.replace('-', '_')}`,
          aggregations: key ? [key] : [],
        });
      }
    }
  });
  return metrics;
};

export const InitMetricsFilterValues: any = {
  frequency: INTERVAL_FREQUENCY_LIST[0].value,
  instanceList: ['all'],
  timeRange: TIME_OPTION_TYPE.HOUR1,
  space: "",
  period: SERVICE_QUERY_PERIOD,
  metricType: AGGREGATION_OPTIONS[0],
};

export const InitMachineMetricsFilterValues: any = {
  frequency: INTERVAL_FREQUENCY_LIST[0].value,
  instanceList: ['all'],
  timeRange: TIME_OPTION_TYPE.HOUR1,
}

export const getRawQueryByAggregation = (aggregation: AggregationType, metric: string): string => {
  switch (aggregation) {
    case AggregationType.Avg:
      return `avg(${metric})`;
    case AggregationType.Sum:
      return `sum(${metric})`;
    case AggregationType.Rate:
      return `rate(${metric}[5s])`;
    case AggregationType.P75:
      return `quantile(0.75, sum(rate(${metric}[5s])) by (instance))`
    case AggregationType.P95:
      return `quantile(0.95, sum(rate(${metric}[5s])) by (instance))`
    case AggregationType.P99:
      return `quantile(0.99, sum(rate(${metric}[5s])) by (instance))`
    case AggregationType.P999:
      return `quantile(0.999, sum(rate(${metric}[5s])) by (instance))`
  }
}

export const RawServiceMetrics = [
  "context_switches_total",
  "cpu_seconds_total",
  "memory_bytes_gauge",
  "open_filedesc_gauge",
  "read_bytes_total",
]

export const getQueryMap = (metricItem: IServiceMetricItem) => {
  const res = {};
  METRIC_FUNCTIONS.forEach(mf => {
    res[mf] = getRawQueryByAggregation(mf, `${metricItem.prefixMetric}_${metricItem.metric}`)
  })
  return res;
}

export const getRawServiceMetricQueryMap = (metricItem: IServiceMetricItem) => {
  const map = {};
  RawServiceMetrics.forEach(m => {
    map[m] = getQueryMap(metricItem)
  })
  return map;
}

export const getQueryByMetricType = (metricItem: IServiceMetricItem, metricType: AggregationType, period: string): string => {
  if (metricItem.isRawMetric) {
    return `${metricItem.prefixMetric}_${metricItem.metric}`
  } else {
    return `${metricItem.prefixMetric}_${metricItem.metric}_${metricType}_${period}`
  }
}

export const tooltipTitle = time =>
  dayjs(Number(time) * 1000).format('YYYY-MM-DD HH:mm:ss');

export const updateChartByValueType = (options, chartInstance) => {
  switch (options.valueType) {
    case VALUE_TYPE.status:
      chartInstance.axis('value', {
        label: {
          formatter: value => Number(value) ? 'online' : 'offline',
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            const value = `${Number(item.value) ? 'online' : 'offline'}`;
            return {
              ...item,
              value,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      chartInstance.scale({
        value: {
          min: 0,
          max: options.maxNum || 100,
          tickInterval: options.maxNum ? (options.maxNum % 10 + 10) / 5 : 25,
        },
      });
      break;
    case VALUE_TYPE.percentage:
      chartInstance.axis('value', {
        label: {
          formatter: percent => `${percent}%`,
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            const value = `${Number(item.value).toFixed(2)}%`;
            return {
              ...item,
              value,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      chartInstance.scale({
        value: {
          min: 0,
          max: options.maxNum || 100,
          tickInterval: options.maxNum ? (options.maxNum % 10 + 10) / 5 : 25,
        },
      });
      break;
    case VALUE_TYPE.byte:
    case VALUE_TYPE.byteSecond:
      chartInstance.axis('value', {
        label: {
          formatter: bytes => {
            const { value, unit } = getProperByteDesc(Number(bytes));
            let _unit = unit;
            if (options.valueType === VALUE_TYPE.byteSecond) {
              _unit = `${unit}/s`;
            }

            return `${value} ${_unit}`;
          },
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            const { value, unit } = getProperByteDesc(Number(item.value));
            let _unit = unit;
            if (options.valueType === VALUE_TYPE.byteSecond) {
              _unit = `${unit}/s`;
            }
            return {
              ...item,
              value: `${value} ${_unit}`,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      break;
    case VALUE_TYPE.byteSecondNet:
      chartInstance.axis('value', {
        label: {
          formatter: bytes => {
            const { value, unit } = getProperByteDesc(Number(bytes));
            const _unit = `${unit}/s`;
            return `${value} ${_unit}`;
          },
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            const { value, unit } = getProperByteDesc(Number(item.value));
            const _unit = `${unit}/s`;
            return {
              ...item,
              value: `${value} ${_unit}`,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      break;
    case VALUE_TYPE.diskIONet:
      chartInstance.axis('value', {
        label: {
          formatter: processNum => `${processNum} io/s`,
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            const value = `${Number(item.value).toFixed(2)} io/s`;
            return {
              ...item,
              value,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      break;
    case VALUE_TYPE.number:
    case VALUE_TYPE.numberSecond:
      chartInstance.axis('value', {
        label: {
          formatter: processNum => {
            if (options.valueType === VALUE_TYPE.numberSecond) {
              return `${processNum}/s`;
            }
            return processNum;
          },
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            let value = (Math.round(+item.value * 100) / 100).toString();
            if (options.valueType === VALUE_TYPE.numberSecond) {
              value = `${value}/s`;
            }
            return {
              ...item,
              value,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      break;
    case VALUE_TYPE.latency:
      chartInstance.axis('value', {
        label: {
          formatter: processNum => {
            return getAutoLatency(processNum);
          },
        },
      });
      chartInstance.tooltip({
        customItems: items =>
          items.map(item => {
            let value = getAutoLatency(item.value);
            return {
              ...item,
              value,
            };
          }),
        showCrosshairs: true,
        shared: true,
        title: tooltipTitle,
      });
      break;
    default:
  }
}

export const isLatencyMetric = metric => metric.includes('latency');

export const isProcessMetric = metric => RawServiceMetrics.some(rawMetric => metric.includes(rawMetric));