#!/usr/bin/env node
import 'source-map-support/register';
import 'dotenv/config'
import * as cdk from 'aws-cdk-lib';
import { PipelineAppStack } from '../lib/pipeline-app-stack';

const primaryAccount = process.env.PRIMARY_ACCOUNT
const primaryRegion = process.env.PRIMARY_REGION

const app = new cdk.App();
new PipelineAppStack(app, 'PipelineAppStack', {
  env: { account: primaryAccount, region: primaryRegion },
});
