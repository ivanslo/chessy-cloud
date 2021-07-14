# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 


## More Commands

* `cdk deploy --profile <profile-name>`	to use the specific aws profile from `~/.aws/credentials`
* `cdk bootstrap`	From Doc: 
	Many AWS CDK stacks that you write will include assets: external files that are deployed with the stack, such as AWS Lambda functions Docker images. The AWS CDK uploads these to an Amazon S3 bucket or other container so they are available to AWS CloudFormation during deployment
