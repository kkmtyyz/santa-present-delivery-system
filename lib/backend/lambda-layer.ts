import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";

export class SpLambdaLayer extends Construct {
  layer: lambda.ILayerVersion;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Layer
    // cdk synthでパッケージダウンロードするためdockerの起動が必要
    this.layer = new lambdaPython.PythonLayerVersion(this, "LambdaLayer", {
      entry: "resources/lambda/layer",
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    });
  }
}
