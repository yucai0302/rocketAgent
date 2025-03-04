#!/bin/bash

# Create temporary directory
echo "Creating temporary directory..."
mkdir -p temp_deploy

# Copy necessary files
echo "Copying files..."
cp app.py temp_deploy/
cp requirements.txt temp_deploy/
cp -r templates temp_deploy/
cp -r static temp_deploy/
cp deploy_centos.sh temp_deploy/

# Create .env file
echo "Creating .env file..."
cat > temp_deploy/.env << EOL
DEEPSEEK_API_KEY=your_api_key_here
EOL

# Compress files
echo "Compressing files..."
tar -czf deploy.tar.gz -C temp_deploy .

# Create remote directory
echo "Creating remote directory..."
ssh root@8.130.76.135 "mkdir -p /var/www/ai_qa_agent"

# Upload files
echo "Uploading files..."
scp deploy.tar.gz root@8.130.76.135:/var/www/ai_qa_agent/

# Clean up
echo "Cleaning up..."
rm -rf temp_deploy deploy.tar.gz

echo "Upload completed!"
echo "Please SSH into the server and run the following commands:"
echo "cd /var/www/ai_qa_agent"
echo "tar -xzf deploy.tar.gz"
echo "chmod +x deploy_centos.sh"
echo "./deploy_centos.sh" 