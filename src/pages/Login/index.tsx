import { Button, Form, Input, Select } from 'antd';
// import { FormInstance, FormProps } from 'antd/lib/form/Form';
import React from 'react';
import intl from 'react-intl-universal';
import { connect } from 'react-redux';
import { RouteComponentProps } from 'react-router-dom';
import {
  passwordRulesFn,
  usernameRulesFn,
  // versionRulesFn,
} from '@/config/rules';
import LanguageSelect from '@/components/LanguageSelect';
// import { VERSIONS } from '@/utils/dashboard';
import './index.less';
import nebulaLogo from '@/static/images/nebula_logo.png';
import { IDispatch, IRootState } from '@/store';
import { LanguageContext } from '@/context';
// import { SessionStorageUtil } from '@/utils';

const FormItem = Form.Item;

const fomrItemLayout = {
  wrapperCol: {
    span: 24,
  },
};

const mapState = (state: IRootState) => ({
  appVersion: state.app.version,
  connection: state.app.connection,
  currentSpace: state.nebula.currentSpace,
  spaces: state.nebula.spaces,
});

const mapDispatch: any = (dispatch: IDispatch) => ({
  asyncLogin: dispatch.app.asyncLogin,
  asyncGetAppInfo: dispatch.app.asyncGetAppInfo,
  asyncUseSpaces: dispatch.nebula.asyncUseSpaces,
  asyncGetSpaces: dispatch.nebula.asyncGetSpaces,
  asyncGetCustomConfig: dispatch.app.asyncGetCustomConfig,
  // updateVersion: values =>
  //   dispatch.nebula.update({
  //     version: values,
  //   }),
});

interface IProps
  extends ReturnType<typeof mapState>,
  ReturnType<typeof mapDispatch>,
  RouteComponentProps { }
class ConfigServerForm extends React.Component<IProps> {
  componentDidMount() {
    this.props.asyncGetAppInfo();
    this.props.asyncGetCustomConfig();
  }

  onConfig = async (values: any) => {
    const { connection, currentSpace } = this.props;
    const ok = await this.props.asyncLogin({
      ip: connection.ip,
      port: connection.port,
      ...values,
    });
    if (ok) {
      // SessionStorageUtil.setItem('version', values.version)
      // this.props.updateVersion(values.version);
      this.props.history.push('/machine/overview');
      await this.props.asyncGetSpaces()
      if (currentSpace && this.props.spaces.includes(currentSpace)) {
        this.props.asyncUseSpaces(currentSpace)
      }
    }
  };

  render() {
    const { appVersion } = this.props;
    return (
      <div className="page-login">
        <div className="right">
          <img src={nebulaLogo} className="logo" />
          <div className="title">
            <p>{process.env.PRODUCT_NAME}</p>
            <p>Dashboard</p>
          </div>
          <p className="form-header">{intl.get('common.account')}</p>
          <Form
            layout="horizontal"
            {...fomrItemLayout}
            onFinish={this.onConfig}
          >
            <FormItem name="username" rules={usernameRulesFn(intl)}>
              <Input
                placeholder={intl.get('common.username')}
                bordered={false}
              />
            </FormItem>
            <FormItem name="password" rules={passwordRulesFn(intl)}>
              <Input
                type="password"
                placeholder={intl.get('common.password')}
                bordered={false}
              />
            </FormItem>
            {/* <FormItem name="version" rules={versionRulesFn(intl)}>
              <Select>
                {VERSIONS.map(version => (
                  <Select.Option value={version} key={version}>
                    {version}
                  </Select.Option>
                ))}
              </Select>
            </FormItem> */}
            <Button className="btn-submit" type="primary" htmlType="submit">
              {intl.get('common.login')}
            </Button>
          </Form>
          <div className="footer">
            <div className="footer-action">
              <span>
                <LanguageContext.Consumer>
                  {({ currentLocale, toggleLanguage }) => (
                    <LanguageSelect
                      showIcon
                      currentLocale={currentLocale}
                      toggleLanguage={toggleLanguage}
                    />
                  )}
                </LanguageContext.Consumer>
              </span>
              <span className="version">
                {intl.get('common.version')}：{appVersion}
              </span>
            </div>
            <div className="power-info">{intl.get('common.powerInfo')}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default connect(mapState, mapDispatch)(ConfigServerForm);
