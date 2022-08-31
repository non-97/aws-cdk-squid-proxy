# -x to display the command to be executed
set -x

# Redirect /var/log/user-data.log and /dev/console
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# Install the necessary packages.
yum install -y squid httpd-tools
amazon-linux-extras install -y collectd

# Update
yum update -y

# Create a mount point for the EFS File system
mkdir /etc/squid/secrets

# Backup the squid configuration file.
cp -a /etc/squid/squid.conf /etc/squid/squid.conf.`date +"%Y%m%d"`

# Edit the squid configuration file.
sed -i -E 's/http_port 3128/http_port 0.0.0.0:8080/g' /etc/squid/squid.conf
sed -i -E '/^acl localnet src/d' /etc/squid/squid.conf
sed -i -E "/^# should be allowed$/a acl localnet src 10.0.0.0/24" /etc/squid/squid.conf

tee /etc/squid/squid.conf -a <<"EOF" >/dev/null
#  Don't display the version on the error page.
httpd_suppress_version_string on

# Anonymize hostnames
visible_hostname unknown

# Setting log format to Apache combined
logformat combined %>a %[ui %[un [%tl] "%rm %ru HTTP/%rv" %>Hs %<st "%{Referer}>h" "%{User-Agent}>h" %Ss:%Sh
access_log /var/log/squid/access.log combined
EOF


# Check the squid configuration file for incorrect descriptions.
squid -k parse

# Start squid.
systemctl start squid

# Check the status of squid.
systemctl status squid

# Enable squid auto-start.
systemctl enable squid

# Check the squid auto-start setting.
systemctl is-enabled squid