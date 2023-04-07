import { createModel } from '@rematch/core';
import _ from 'lodash';
import serviceApi from '@/config/service';
import { IPanelConfig, ServiceMetricsPanelValue } from '@/utils/interface';
import { DEFAULT_SERVICE_PANEL_CONFIG } from '@/utils/service';
import { AggregationType, getProperStep } from '@/utils/dashboard';
import { isCommunityVersion, unique } from '@/utils';
import { getClusterPrefix } from '@/utils/promQL';
import { InitMetricsFilterValues } from '@/utils/metric';
import { getQueryRangeInfo } from '@/utils';

interface IServiceState {
  panelConfig: IPanelConfig;
  instanceList: string[];
  metricsFilterValues: ServiceMetricsPanelValue;
}

export function SereviceModelWrapper(serviceApi) {
  return createModel({
    state: {
      // panelConfig: localStorage.getItem('panelConfig')
      //   ? JSON.parse(localStorage.getItem('panelConfig')!)
      //   : DEFAULT_SERVICE_PANEL_CONFIG,
      panelConfig: DEFAULT_SERVICE_PANEL_CONFIG,
      instanceList: [],
      metricsFilterValues: InitMetricsFilterValues
    },
    reducers: {
      update: (state: IServiceState, payload: any) => ({
        ...state,
        ...payload,
      }),
      updateInstanceList: (state: IServiceState, payload: any) => {
        const instanceList = unique(state.instanceList.concat(payload));
        return { ...state, instanceList };
      },
      updateMetricsFilterValues: (state: IServiceState, payload: any) => {
        const metricsFilterValues = {
          ...state.metricsFilterValues,
          ...payload.metricsFilterValues
        }
        return {
          ...state,
          metricsFilterValues
        }
      }
    },
    effects: () => ({
      async asyncGetMetricsSumData(payload: {
        query: string;
        start: number;
        end: number;
        space?: string;
        clusterID?: string;
      }) {
        const { start, end, space, query: _query, clusterID } = payload;
        const { start: _start, end: _end, step } = getQueryRangeInfo(start, end);
        let query = `sum(${_query}{${getClusterPrefix()}="${clusterID}"})`;
        query = `${_query}{${getClusterPrefix()}="${clusterID}", space="${space || ''}"}`;
        const { code, data } = (await serviceApi.execPromQLByRange({
          clusterID,
          query,
          start: _start,
          end: _end,
          step,
        })) as any;

        if (code === 0 && data.result.length !== 0) {
          const sumData = {
            metric: {
              instanceName: 'total',
              instance: 'total',
            },
          } as any;
          sumData.values = data.result[0].values;
          return sumData;
        }
        return [];
      },

      async asyncGetMetricsData(payload: {
        query: string;
        space?: string;
        start: number;
        end: number;
        clusterID?: string;
        noSuffix?: boolean;
        isRawMetric?: boolean;
        aggregation: AggregationType;
      }) {
        const {
          start,
          space,
          end,
          query: _query,
          clusterID,
          noSuffix = false,
        } = payload;
        const { start: _start, end: _end, step } = getQueryRangeInfo(start, end);
        let query = _query;
        if (!noSuffix) {
          if (clusterID) {
            if (!payload.isRawMetric && payload.aggregation === AggregationType.Sum) {
              query = `sum_over_time(${_query}{${getClusterPrefix()}="${clusterID}", space="${space || ''}"}[${step}s])`;
            } else {
              if (query.includes('cpu_seconds_total')) {
                query = `avg by (instanceName) (rate(${query}{${getClusterPrefix()}="${clusterID}"}[5m])) * 100`
              } else {
                query = `${_query}{${getClusterPrefix()}="${clusterID}", space="${space || ''}"}`;
              }
            }
          } else {
            query = `${_query}{space="${space || ''}"}`;
          }
        }
        const { code, data } = (await serviceApi.execPromQLByRange({
          clusterID,
          query,
          start: _start,
          end: _end,
          step,
        })) as any;
        let stat = [] as any;
        if (code === 0 && data.result.length !== 0) {
          stat = data.result;
        }
        if (isCommunityVersion()) {
          const list = stat.map(item => {
            const instanceName = item.metric.instanceName || item.metric.instance;
            return instanceName.slice(0, instanceName.indexOf('-'))
          });
          this.updateInstanceList(list)
        }
        return stat;
      },

      async asyncGetStatus(payload: {
        interval: number;
        end: number;
        query: string;
        clusterID?: string;
      }) {
        const { interval, end, query, clusterID } = payload;
        const start = payload.end - interval;
        const { start: _start, end: _end, step } = getQueryRangeInfo(start, end);
        const { code, data } = (await serviceApi.execPromQLByRange({
          clusterID,
          query: clusterID ? `${query}{${getClusterPrefix()}="${clusterID}"}` : query,
          start: _start,
          end: _end,
          step,
        })) as any;
        let normal = 0;
        let abnormal = 0;
        if (code === 0) {
          data.result.forEach(item => {
            const value = item.values.pop();
            if (value[1] === '1') {
              normal++;
            } else {
              abnormal++;
            }
          });
        }
        return {
          normal,
          abnormal,
        };
      },
      updateMetricsFiltervalues(values: ServiceMetricsPanelValue) {
        this.updateMetricsFilterValues({
          metricsFilterValues: values,
        });
      }
    }),
  });
}

export const service = SereviceModelWrapper(serviceApi);