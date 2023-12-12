import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { InfraStage } from './infra-stage';

export class PipelineAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // this stack includes two pipelines, an L3 CDK Pipeline and an L2 CodePipeline using StackSets

    // environment variables
    const primary_account = process.env.PRIMARY_ACCOUNT || ''
    const primary_region = process.env.PRIMARY_REGION || ''
    const wave1_env1_account = process.env.CDKPIPELINE_WAVE1_ENV1_ACCOUNT || ''
    const wave1_env1_region = process.env.CDKPIPELINE_WAVE1_ENV1_REGION || ''
    const wave1_env2_account = process.env.CDKPIPELINE_WAVE1_ENV2_ACCOUNT || ''
    const wave1_env2_region = process.env.CDKPIPELINE_WAVE1_ENV2_REGION || ''
    const wave2_env1_account = process.env.CDKPIPELINE_WAVE2_ENV1_ACCOUNT || ''
    const wave2_env1_region = process.env.CDKPIPELINE_WAVE2_ENV1_REGION || ''
    const stackset_env_account = process.env.STACKSET_ENV_ACCOUNT || ''
    const stackset_env_region = process.env.STACKSET_ENV_REGIONS || ''

    // CodeCommit repository should exist before initial deployment
    const repo = codecommit.Repository.fromRepositoryName(this, 'Repository', 'infra-project')

    // CDK Pipelines do not integrate nicely with AWS Organizations but can reference pre-generated environment variables
    const pipelineCdk = new pipelines.CodePipeline(this, 'Pipeline', {
      crossAccountKeys: true,
      pipelineName: 'InfraPipeline',
      synth: new pipelines.CodeBuildStep('SynthStep', {
        input: pipelines.CodePipelineSource.codeCommit(repo, 'main'),
        installCommands: [
          'npm install -g aws-cdk dotenv'
        ],
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth'
        ],
        // this is messy and would be cleaner with ssm lookups or utilizing stacksets over cdk pipelines
        env: {
          PRIMARY_ACCOUNT: primary_account,
          PRIMARY_REGION: primary_region,
          CDKPIPELINE_WAVE1_ENV1_ACCOUNT: wave1_env1_account,
          CDKPIPELINE_WAVE1_ENV1_REGION: wave1_env1_region,
          CDKPIPELINE_WAVE1_ENV2_ACCOUNT: wave1_env2_account,
          CDKPIPELINE_WAVE1_ENV2_REGION: wave1_env2_region,
          CDKPIPELINE_WAVE2_ENV1_ACCOUNT: wave2_env1_account,
          CDKPIPELINE_WAVE2_ENV1_REGION: wave2_env1_region,
          STACKSET_ENV_ACCOUNT: stackset_env_account,
          STACKSET_ENV_REGIONS: stackset_env_region,
        }
      }),
    });

    // deploy in waves
    const infraWave = pipelineCdk.addWave('Infra');
    infraWave.addStage(new InfraStage(this, 'infra-syd', {
      env: { account: wave1_env1_account, region: wave1_env1_region }
    }));
    infraWave.addStage(new InfraStage(this, 'infra-sg', {
      env: { account: wave1_env2_account, region: wave1_env2_region }
    }));

    // additional waves
    const nonProdWave = pipelineCdk.addWave('NonProd');
    nonProdWave.addStage(new InfraStage(this, 'infra-tok', {
      env: { account: wave2_env1_account, region: wave2_env1_region }
    }));

    // as an alternative to CDK Pipelines, utilize the L2 CodePipelines construct
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: repo,
      branch: 'main',
      output: sourceOutput,
    })
    // configure project to build stackset yaml.
    const project = new codebuild.PipelineProject(this, 'GenerateStackSet', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'echo "Generate template.yaml"'
              // this is where you would generate your cfn template. instead we'll use from repository
            ],
          },
        },
      }),
    })
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project,
      input: sourceOutput,
      outputs: [buildOutput],
    });
    const pipelinel2 = new codepipeline.Pipeline(this, 'PipelineL2', {
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        }, {
          stageName: 'Build',
          actions: [buildAction],
        }
      ],
    });
  
    const actionDeployStackSetAction = new codepipeline_actions.CloudFormationDeployStackSetAction({
      actionName: 'UpdateStackSet',
      runOrder: 1,
      stackSetName: 'EnableAWSCloudtrail',
      template: codepipeline_actions.StackSetTemplate.fromArtifactPath(sourceOutput.atPath('stackSets/EnableAWSCloudtrail.yml')),

      // Change this to 'StackSetDeploymentModel.organizations()' if you want to deploy to OUs
      deploymentModel: codepipeline_actions.StackSetDeploymentModel.selfManaged(),
      // This deploys to a set of accounts
      stackInstances: codepipeline_actions.StackInstances.inAccounts(
        stackset_env_account!.split(','),
        stackset_env_region!.split(',')
      ),
    })
    const actionDeployStackInstancesAction = new codepipeline_actions.CloudFormationDeployStackInstancesAction({
      actionName: 'AddMoreInstances',
      runOrder: 2,
      stackSetName: 'EnableAWSCloudtrail',
      stackInstances: codepipeline_actions.StackInstances.inAccounts(
        stackset_env_account!.split(','),
        stackset_env_region!.split(',')
      ),
    })

    pipelinel2.addStage({
      stageName: 'DeployStackSets',
      actions: [
        // First, update the StackSet itself with the newest template
        actionDeployStackSetAction,
    
        // Afterwards, update/create additional instances in other accounts
        actionDeployStackInstancesAction
      ],
    });
  }
}
