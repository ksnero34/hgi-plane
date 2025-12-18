import os

bashrc_path = os.path.expanduser("~/.bashrc")
new_line = 'export PATH=$(echo "$PATH" | sed -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/linux/bin/[:]*||g" -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/win32/bin/[:]*||g" -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/win32/docker-cli-plugins/[:]*||g" -e "s|/mnt/c/Program Files/Rancher Desktop/resources/resources/linux/docker-cli-plugins/[:]*||g")'

with open(bashrc_path, "r") as f:
    lines = f.readlines()

new_lines = []
replaced = False
for line in lines:
    if "Rancher Desktop" in line and "export PATH=" in line:
        # Found the old line, replace it
        new_lines.append("# Fixed by Antigravity to remove win32/bin resources\n")
        new_lines.append(new_line + "\n")
        replaced = True
    else:
        new_lines.append(line)

if not replaced:
    # Append if not found
    new_lines.append("\n# Fixed by Antigravity to remove win32/bin resources\n")
    new_lines.append(new_line + "\n")

with open(bashrc_path, "w") as f:
    f.writelines(new_lines)

print("Updated .bashrc successfully.")
