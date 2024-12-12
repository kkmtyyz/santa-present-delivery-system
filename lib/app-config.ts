export class SpConfig {
  /*
   * general
   */
  appName = "santa-present";

  /*
   * vpc
   */
  vpcCidr = "10.0.0.0/16";

  /*
   * bedrock model used in letter-analysis-function
   */
  modelId = "anthropic.claude-3-5-sonnet-20240620-v1:0";

  /*
   * aurora
   */
  auroraUsername = "postgres";
  auroraSecretName = `${this.appName}/aurora`;

  /*
   * ssm parameter name
   */
  appAPIKeyParameter = "/santa-present/api-key";
  hereDeveloperAPIKeyParameter = `/${this.appName}/here-developer-api-key`;
  herePlatformAPIKeyParameter = `/${this.appName}/here-platform-api-key`;
}
