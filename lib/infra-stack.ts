import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class InfraStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);

      // SSM is being used to demonstrate some configuration being deployed.
      new ssm.StringParameter(this, 'InfraParameter', {
        allowedPattern: '.*',
        description: 'Infra configuration',
        stringValue: 'infrastructure string',
      });
    }
}