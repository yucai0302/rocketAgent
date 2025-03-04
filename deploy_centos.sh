#!/bin/bash

# Exit on error
set -e

echo "Starting deployment..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a service exists
service_exists() {
    systemctl list-unit-files | grep -q "$1.service"
}

# Update system packages
echo "Updating system packages..."
yum update -y

# Install system dependencies
echo "Installing system dependencies..."
yum install -y python3 python3-pip python3-devel redis gcc

# Configure Redis
echo "Configuring Redis..."
if service_exists redis; then
    systemctl enable redis
    systemctl start redis
else
    echo "Redis service not found. Please check Redis installation."
    exit 1
fi

# Create project directory
echo "Creating project directory..."
mkdir -p /var/www/ai_qa_agent
chown -R root:root /var/www/ai_qa_agent

# Set up Python virtual environment
echo "Setting up Python virtual environment..."
cd /var/www/ai_qa_agent
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "Installing Python dependencies..."
pip install flask flask-socketio flask-cors openai==0.28.1 python-dotenv gunicorn eventlet

# Create data directory
echo "Creating data directory..."
mkdir -p /var/www/ai_qa_agent/data

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/ai_qa_agent.service << 'EOL'
[Unit]
Description=AI QA Agent
After=network.target

[Service]
User=root
Group=root
WorkingDirectory=/var/www/ai_qa_agent
Environment="PATH=/var/www/ai_qa_agent/venv/bin"
ExecStart=/var/www/ai_qa_agent/venv/bin/gunicorn --worker-class eventlet -w 1 --timeout 120 --keep-alive 5 --log-level debug --access-logfile /var/log/ai_qa_agent/access.log --error-logfile /var/log/ai_qa_agent/error.log app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd and start service
echo "Starting application service..."
systemctl daemon-reload
systemctl enable ai_qa_agent
systemctl start ai_qa_agent

# Configure firewall
echo "Configuring firewall..."
if command_exists firewall-cmd; then
    systemctl start firewalld
    systemctl enable firewalld
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
else
    echo "FirewallD not found. Please configure your firewall manually."
fi

echo "Deployment completed!"
echo "You can now access the application at http://8.130.76.135" 