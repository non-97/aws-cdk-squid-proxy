import { aws_iam as iam, aws_ec2 as ec2, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";

export class SquidStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // SSM IAM role
    const ssmIamRole = new iam.Role(this, "SSM IAM Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    //  VPC for inspection
    const vpc = new ec2.Vpc(this, "VPC", {
      cidr: "10.0.0.0/24",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 1,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 27,
        },
      ],
    });

    // Security Group
    // For Squid
    const squidSg = new ec2.SecurityGroup(this, "Squid SG", {
      allowAllOutbound: true,
      vpc,
    });
    squidSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(8080));

    // User data for Squid
    const userDataParameter = fs.readFileSync(
      path.join(__dirname, "../src/ec2/user_data_setting_squid.sh"),
      "utf8"
    );
    const userDataSettingPostfix = ec2.UserData.forLinux({
      shebang: "#!/bin/bash",
    });
    userDataSettingPostfix.addCommands(userDataParameter);

    // Squid EC2 Instance
    new ec2.Instance(this, `Squid EC2 Instance`, {
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      instanceType: new ec2.InstanceType("t3.micro"),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      securityGroup: squidSg,
      role: ssmIamRole,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      propagateTagsToVolumeOnCreation: true,
      userData: userDataSettingPostfix,
    });

    // Client EC2 Instance
    new ec2.Instance(this, `Client EC2 Instance`, {
      machineImage: ec2.MachineImage.latestAmazonLinux({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      instanceType: new ec2.InstanceType("t3.micro"),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      role: ssmIamRole,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
      propagateTagsToVolumeOnCreation: true,
    });
  }
}
