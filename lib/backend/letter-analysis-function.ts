import { Construct } from "constructs";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSource from "aws-cdk-lib/aws-lambda-event-sources";
import * as iam from "aws-cdk-lib/aws-iam";
import { SpConfig } from "../app-config";
import { SpVpc } from "../network/vpc";
import { SpLambdaLayer } from "./lambda-layer";

interface SpLetterAnalysisFunctionProps {
  spConfig: SpConfig;
  spVpc: SpVpc;
  spLambdaLayer: SpLambdaLayer;
}

export class SpLetterAnalysisFunction extends Construct {
  letterBucket: s3.Bucket;
  letterEventQueue: sqs.Queue;
  functionRole: iam.Role;
  functionSg: ec2.SecurityGroup;
  function: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: SpLetterAnalysisFunctionProps,
  ) {
    super(scope, id);
    const spConfig = props.spConfig;
    const spVpc = props.spVpc;
    const spLambdaLayer = props.spLambdaLayer;

    // 手紙の画像が格納されるバケット
    this.letterBucket = new s3.Bucket(this, "LetterBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Lambdaトリガー用キュー
    const LetterEventDeadQueue = new sqs.Queue(this, "LetterEventDeadQueue", {
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    this.letterEventQueue = new sqs.Queue(this, "LetterEventQueue", {
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: LetterEventDeadQueue,
      },
    });

    // Lambdaトリガー用イベント通知
    this.letterBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(this.letterEventQueue),
    );

    // Lambda関数用IAM Role
    this.functionRole = new iam.Role(this, "LambdaFunctionRole", {
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
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject"],
          resources: [
            this.letterBucket.bucketArn,
            `${this.letterBucket.bucketArn}/*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["bedrock:InvokeModel"],
          resources: ["*"],
        }),
      ],
    }).attachToRole(this.functionRole);

    // Lambda関数用Security Group
    this.functionSg = new ec2.SecurityGroup(this, "FunctionSecurityGroup", {
      vpc: spVpc.vpc,
    });

    // Function
    this.function = new lambda.Function(this, "AnalyzeLetterFunction", {
      handler: "lambda_function.lambda_handler",
      runtime: lambda.Runtime.PYTHON_3_12,
      timeout: Duration.minutes(15),
      memorySize: 1024,
      reservedConcurrentExecutions: 10, // Note: Auroraへの接続数に影響
      role: this.functionRole,
      securityGroups: [this.functionSg],
      vpc: spVpc.vpc,
      vpcSubnets: { subnets: spVpc.privateSubnets },
      applicationLogLevelV2: lambda.ApplicationLogLevel.DEBUG,
      loggingFormat: lambda.LoggingFormat.JSON,
      code: lambda.Code.fromAsset("resources/lambda/letter-analysis-function"),
      layers: [spLambdaLayer.layer],
      environment: {
        S3_REGION: cdk.Stack.of(this).region,
        BEDROCK_MODEL_REGION: cdk.Stack.of(this).region,
        BEDROCK_MODEL_ID: spConfig.modelId,
        AURORA_SECRET_NAME: spConfig.auroraSecretName,
      },
    });

    // SQSからトリガーする
    this.function.addEventSource(
      new lambdaEventSource.SqsEventSource(this.letterEventQueue, {
        reportBatchItemFailures: true,
      }),
    );
  }
}
