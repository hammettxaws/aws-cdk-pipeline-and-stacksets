# CDK Pipeline and CloudFormation Stacksets demo

Create a CDK Pipeline that utilizes CDK Pipelines and CloudFormation StackSets to deploy configuration across an AWS Organization.

This project will deploy two CodePipeline pipelines running in the Primary account and region. One built with CDK Pipelines (L3 construct) and CodePipelines (L2 construct). Both pipelines will be visibile in the prmiary account/region specified in environments.

## Getting Started

To simplify the configuration of this repository, environmental variables are used to define the resources to deploy to.

Update `.env` with account and region settings. This has been used for simplicity.

```.env
# the source account where the cdk pipeline will be configured
PRIMARY_ACCOUNT=xxxx
PRIMARY_REGION=ap-southeast-2

# cdk pipeline environment details
CDKPIPELINE_WAVE1_ENV1=xxxx,ap-southeast-2
CDKPIPELINE_WAVE1_ENV2=xxxx,ap-southeast-2
CDKPIPELINE_WAVE2_ENV1=xxxx,ap-southeast-2

# stackset account and regions details
STACKSET_ACCOUNTS=xxxx
STACKSET_REGIONS=ap-southeast-2
```

## Bootstrap CDK

Before you begin, bootstrap all environments targetted with account/region pairs.

```bash
npm run cdk -- bootstrap \
  <ACCOUNT_1>/<REGION_1> \
  <ACCOUNT_2>/<REGION_2> \
  <ACCOUNT_3>/<REGION_3>
```

## Code Repository

The pipeline references a CodeCommit repository, `infra-project`.

```bash
aws codecommit create-repository --repository-name infra-project
```

Configure the local repository with the codecommit repository and push code in preparation for the initial deployment.

## Deploy Stack

Deploy the pipeline.

```bash
npm run cdk -- deploy PipelineAppStack
```

Once this is deployed future changes should be done by pushing updates to the CodeCommit repository.

## AWS Organizations

To simplify this sample code, hard coded AWS Account and AWS Regions are utilised. Code comments note where you can modify configuration to use AWS Organizations.

Stacksets still require permissions when deploying stacksets within a single account.
https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-prereqs-self-managed.html
