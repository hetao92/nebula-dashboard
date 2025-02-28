import { createModel } from '@rematch/core';
import _ from 'lodash';
import { compare } from 'compare-versions';
import service from '@/config/service';
import { filterServiceMetrics } from '@/utils/metric';
import { getClusterPrefix, diskPararms } from '@/utils/promQL';
import { formatVersion } from '@/utils/dashboard';
import { ServiceName } from '@/utils/interface';

export function MetricModelWrapper(serviceApi) {
  return createModel({
    state: {
      [ServiceName.GRAPHD]: [],
      [ServiceName.METAD]: [],
      [ServiceName.STORAGED]: [],
      [ServiceName.MetadListener]: [],
      [ServiceName.StoragedListener]: [],
      [ServiceName.Drainer]: [],
      spaces: [],
      devices: [],
      ready: false
    },
    reducers: {
      update: (state: any, payload: any) => ({
        ...state,
        ...payload,
      }),
    },
    effects: () => ({
      async asyncGetServiceMetric(payload: {
        clusterID?: string;
        componentType: ServiceName;
        version: string;
      }) {
        const { componentType, version, clusterID } = payload;
        let metricList = [];
        let spaceMetricList: any = [];
        const curVersion = formatVersion(version);
        const clusterSuffix1 = clusterID ? `,${getClusterPrefix()}='${clusterID}'` : '';
        switch (true) {
          case compare(curVersion, '3.0.0', '<'): {
            const { code, data } = (await serviceApi.getMetrics({
              clusterID,
              'match[]': `{componentType="${componentType}",__name__!~"ALERTS.*",__name__!~".*count"${clusterSuffix1}}`,
            })) as any;
            if (code === 0) {
              metricList = data;
            }
            break;
          }
          case compare(curVersion, '3.0.0', '>='):
            {
              const { code, data: metricData } =
                (await serviceApi.getMetrics({
                  clusterID,
                  'match[]': `{componentType="${componentType}"${componentType === ServiceName.GRAPHD ? `,space=""` : ''},__name__!~"ALERTS.*",__name__!~".*count"${clusterSuffix1}}`,
                })) as any;
              if (code === 0) {
                metricList = metricData;
              }

              if (componentType === ServiceName.GRAPHD) {
                const { code, data } = (await serviceApi.getMetrics({
                  clusterID,
                  'match[]': `{componentType="${componentType}",space!="",__name__!~"ALERTS.*",__name__!~".*count"${clusterSuffix1}}`,
                })) as any;
                if (code === 0) {
                  spaceMetricList = data;
                }
              }
            }
            break;
          default:
            break;
        }
        const metrics = filterServiceMetrics({
          metricList,
          componentType,
          spaceMetricList,
          version,
        });
        this.update({
          [componentType]: metrics,
        });
      },

      async asyncGetSpaces({ clusterID, start, end }) {
        start = start / 1000;
        end = end / 1000;
        const { data: res } = (await service.getSpaces({
          'match[]': clusterID ? `{${getClusterPrefix()}='${clusterID}'}` : undefined,
          start,
          end
        })) as any;
        if (Array.isArray(res)) {
          this.update({
            spaces: res,
          });
        } else if (res.code === 0) {
          this.update({
            spaces: res.data,
          });
        }
      },
      async asyncDevices(clusterID) {
        const { data: res } = (await service.getDevices({
          'match[]': clusterID ? `{${diskPararms}, ${getClusterPrefix()}='${clusterID}'}` : undefined,
        })) as any;
        if (Array.isArray(res)) {
          this.update({
            devices: res,
          });
        } else if (res.code === 0) {
          this.update({
            devices: res.data,
          });
        }
      },
    }),
  });
}

export const serviceMetric = MetricModelWrapper(service);
