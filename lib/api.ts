import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";
import * as iam from "aws-cdk-lib/aws-iam";
import { SpConfig } from "./app-config";
import { SpVpc } from "./vpc";
import { SpWeb } from "./web";
import { SpLambdaLayer } from "./lambda-layer";

interface SpApiProps {
  spConfig: SpConfig;
  spVpc: SpVpc;
  spLambdaLayer: SpLambdaLayer;
  spWeb: SpWeb;
}

export class SpApi extends Construct {
  functionRole: iam.Role;
  functionSg: ec2.SecurityGroup;
  function: lambda.Function;
  apiUrl: string;

  constructor(scope: Construct, id: string, props: SpApiProps) {
    super(scope, id);
    const spConfig = props.spConfig;
    const spVpc = props.spVpc;
    const spLambdalayer = props.spLambdaLayer;
    const spWeb = props.spWeb;

    // Lambda関数用IAM Role
    this.functionRole = new iam.Role(this, "FunctionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    this.functionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaVPCAccessExecutionRole",
      ),
    );
    this.functionRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess"),
    );

    new iam.Policy(this, "FunctionRolePolicy", {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["secretsmanager:GetSecretValue"],
          resources: [
            `arn:aws:secretsmanager:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:secret:*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ssm:GetParameter"],
          resources: [
            `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${spConfig.hereDeveloperAPIKeyParameter}`,
            `arn:aws:ssm:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:parameter${spConfig.herePlatformAPIKeyParameter}`,
          ],
        }),
      ],
    }).attachToRole(this.functionRole);

    // Lambda関数用Security Group
    this.functionSg = new ec2.SecurityGroup(this, "FunctionSecurityGroup", {
      vpc: spVpc.vpc,
    });

    // Function
    this.function = new lambda.Function(this, "ApiFunction", {
      handler: "lambda_function.lambda_handler",
      runtime: lambda.Runtime.PYTHON_3_12,
      timeout: Duration.minutes(15),
      memorySize: 1024,
      reservedConcurrentExecutions: 10, // Note: Auroraへの接続数に影響
      role: this.functionRole,
      securityGroups: [this.functionSg],
      vpc: spVpc.vpc,
      //vpcSubnets: { subnets: spVpc.publicSubnets },
      vpcSubnets: { subnets: spVpc.privateSubnets },
      applicationLogLevelV2: lambda.ApplicationLogLevel.DEBUG,
      loggingFormat: lambda.LoggingFormat.JSON,
      code: lambda.Code.fromAsset("resources/lambda/api-function"),
      layers: [spLambdalayer.layer],
      allowPublicSubnet: true,
      environment: {
        APP_API_KEY_PARAMETER: spConfig.appAPIKeyParameter,
        AURORA_SECRET_NAME: spConfig.auroraSecretName,
        HERE_DEVELOPER_API_KEY_PARAMETER: spConfig.hereDeveloperAPIKeyParameter,
        HERE_PLATFORM_API_KEY_PARAMETER: spConfig.herePlatformAPIKeyParameter,
      },
    });

    const functionUrl = this.function.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedOrigins: [
          `https://${spWeb.webDistribution.distributionDomainName}`,
        ],
      },
    });

    this.apiUrl = functionUrl.url;
  }
}
