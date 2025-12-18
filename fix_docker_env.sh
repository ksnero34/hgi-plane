#!/bin/bash
# fix_docker_env.sh

echo "Analyzing environment..."

# 1. Update .bashrc for PATH
# The user's current PATH contains /win32/bin which causes the exec format error.
# We need to construct a robust sed command to remove these paths.

RC_FILE="$HOME/.bashrc"
echo "Checking $RC_FILE..."

# We will comment out the old sed command if found, and append the new one.
# It's safer to just output the instructions for the user to double check, 
# or we can try to automate it if the user trusts us. 
# Given the user complained "I put this in bashrc but it's still like this",
# they probably want it fixed.

# The correct filter should remove both linux and win32 bin paths.
NEW_EXPORT='export PATH=$(echo "$PATH" | sed -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/linux/bin/[:]*||g" -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/win32/bin/[:]*||g" -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/win32/docker-cli-plugins/[:]*||g" -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/linux/docker-cli-plugins/[:]*||g")'

echo "=================================================="
echo "SUGGESTED CHANGE FOR ~/.bashrc:"
echo "Replace your existing export PATH command with:"
echo "$NEW_EXPORT"
echo "=================================================="

# 2. Fix ~/.docker/config.json
CONFIG_FILE="$HOME/.docker/config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo "Checking $CONFIG_FILE..."
    if grep -q "wincred" "$CONFIG_FILE" || grep -q "desktop.exe" "$CONFIG_FILE"; then
        echo "Found Windows credential helper in config.json. Removing..."
        cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"
        # Remove lines with credsStore or credHelpers that point to wincred/desktop.exe
        # This is a bit aggressive but usually these are single lines like "credsStore": "wincred",
        sed -i '/wincred/d' "$CONFIG_FILE"
        sed -i '/desktop.exe/d' "$CONFIG_FILE"
        echo "Removed Windows credential helpers from $CONFIG_FILE"
    else
        echo "$CONFIG_FILE looks clean of Windows helpers."
    fi
else
    echo "$CONFIG_FILE does not exist. Configuring empty default..."
    mkdir -p "$HOME/.docker"
    echo '{}' > "$CONFIG_FILE"
fi

echo "Done. Please update your .bashrc manually with the command above, then run 'source ~/.bashrc' or restart your terminal."
