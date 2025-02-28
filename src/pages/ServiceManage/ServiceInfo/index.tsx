import _ from 'lodash';
import React from 'react';
import { Button, Table, message } from 'antd';
import { connect } from 'react-redux';
import { IDispatch, IRootState } from '@/store';
import { TitleInstruction } from '@/components/Instruction';
import intl from 'react-intl-universal';
import Modal from '@/components/Modal';
import SelectSpace from '../SelectSpace';

import './index.less';
import { isCommunityVersion } from '@/utils';

const mapState = (state: IRootState) => ({
  loading: state.loading.effects.nebula.asyncGetServices,
  services: state.nebula.services,
  nebulaConnect: (state.nebula as any).nebulaConnect,
});

const mapDispatch: any = (dispatch: IDispatch) => ({
  asyncGetServices: dispatch.nebula.asyncGetServices,
  asyncExecNGQL: dispatch.nebula.asyncExecNGQL,
});
interface IProps
  extends ReturnType<typeof mapState>,
  ReturnType<typeof mapDispatch> { }

class ServiceInfo extends React.Component<IProps> {
  modalHandler;

  componentDidMount() {
    const { nebulaConnect } = this.props;
    if (isCommunityVersion() || nebulaConnect) {
      this.props.asyncGetServices();
    }
  }

  componentDidUpdate(prevProps) {
    const { nebulaConnect } = this.props;
    if (nebulaConnect !== prevProps.nebulaConnect) {
      this.props.asyncGetServices();
    }
  }
  // handleAddHosts = async (record) => {
  //   const code = this.props.asyncExecNGQL(`ADD HOSTS ${record.Host}:${record.Port}`)
  //   if (code === 0) {
  //     message.success(intl.get('common.addhostSuccess', {host: record.Host}));
  //   }
  // }

  handleHide = async () => {
    this.modalHandler.hide();
    const { code } = await this.props.asyncExecNGQL('SUBMIT JOB BALANCE IN ZONE');
    if (code === 0) {
      message.success(intl.get('common.succeed'));
      this.props.asyncGetServices();
    }
  };

  render() {
    const { services } = this.props;
    const columns = [
      {
        title: (
          <TitleInstruction
            title="Host"
            description={intl.get('description.ip')}
          />
        ),
        dataIndex: 'Host',
      },
      {
        title: (
          <TitleInstruction
            title="Port"
            description={intl.get('description.port')}
          />
        ),
        dataIndex: 'Port',
      },
      {
        title: (
          <TitleInstruction
            title="Status"
            description={intl.get('description.status')}
          />
        ),
        dataIndex: 'Status',
        render: status => (
          <span className={status.toLowerCase()}>{status}</span>
        ),
      },
      {
        title: (
          <TitleInstruction
            title="Git Info Sha"
            description={intl.get('description.gitInfo')}
          />
        ),
        dataIndex: 'Git Info Sha',
      },
      {
        title: (
          <TitleInstruction
            title="Leader Count"
            description={intl.get('description.leaderCount')}
          />
        ),
        dataIndex: 'Leader count',
      },
      {
        title: (
          <TitleInstruction
            title="Partition Distribution"
            description={intl.get('description.partitionDistribution')}
          />
        ),
        dataIndex: 'Partition distribution',
        render: distribution => (
          <div className="partition-table">{distribution}</div>
        ),
      },
      {
        title: (
          <TitleInstruction
            title="Leader Distribution"
            description={intl.get('description.leaderDistribution')}
          />
        ),
        dataIndex: 'Leader distribution',
        render: distribution => (
          <div className="leader-table">{distribution}</div>
        ),
      },
      // {
      //   title: '',
      //   render: (_, record) => (
      //     <Button type="primary" ghost onClick={() => this.handleAddHosts(record)}>
      //       Add Host
      //     </Button>
      //   )
      // }
    ];
    return (
      <div className="service-info">
        <Table
          rowKey={(record: any) => record.Host}
          dataSource={services}
          columns={columns}
          pagination={false}
          tableLayout="fixed"
        />
        <Modal
          title={intl.get('service.chooseSpace')}
          handlerRef={handler => (this.modalHandler = handler)}
          footer={null}
        >
          <SelectSpace onHide={this.handleHide} />
        </Modal>
      </div>
    );
  }
}

export default connect(mapState, mapDispatch)(ServiceInfo);
