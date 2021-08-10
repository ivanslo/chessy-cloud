# Chessy Cloud

This is a cdk script to deploy some aws cloud elements.

These are related to the "chessy project", shared in [my blog](http://ivanslobodiuk.com/)

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy --profile <profile-name>`	to use the specific aws profile from `~/.aws/credentials`
 * `cdk bootstrap`    from official docs:
   > Many AWS CDK stacks that you write will include assets: external files that are deployed with the stack, such as AWS Lambda functions Docker images. The AWS CDK uploads these to an Amazon S3 bucket or other container so they are available to AWS CloudFormation during deployment
