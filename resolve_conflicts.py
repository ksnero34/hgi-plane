#!/usr/bin/env python3
"""
Script to automatically resolve common merge conflicts from v1.1.0 merge
"""

import os
import re
import subprocess
import sys

def get_conflict_files():
    """Get all files with merge conflicts"""
    try:
        result = subprocess.run(['git', 'status', '--porcelain'], 
                              capture_output=True, text=True, check=True)
        conflict_files = []
        for line in result.stdout.split('\n'):
            if line.startswith('UU ') or line.startswith('AA '):
                conflict_files.append(line[3:].strip())
        return conflict_files
    except subprocess.CalledProcessError:
        print("Error: Failed to get git status")
        return []

def resolve_import_conflicts(content):
    """Resolve common import path and type conflicts"""

    # Pattern 1: FC import type
    content = re.sub(
        r'<<<<<<< HEAD\nimport \{ FC \} from "react";\n=======\nimport type \{ FC \} from "react";\n>>>>>>> v1\.1\.0',
        'import type { FC } from "react";',
        content
    )

    # Pattern 2: Button import from @plane/ui to @plane/propel/button
    content = re.sub(
        r'<<<<<<< HEAD\n(.*?)import \{ ([^}]*Button[^}]*) \} from "@plane/ui";\n=======\nimport \{ ([^}]*Button[^}]*) \} from "@plane/propel/button";\n(.*?)>>>>>>> v1\.1\.0',
        r'import { \3 } from "@plane/propel/button";\n\4',
        content,
        flags=re.DOTALL
    )

    # Pattern 3: Toast imports
    content = re.sub(
        r'<<<<<<< HEAD\nimport \{ setToast, TOAST_TYPE \} from "@plane/ui";\n=======\nimport \{ TOAST_TYPE, setToast \} from "@plane/propel/toast";\n>>>>>>> v1\.1\.0',
        'import { TOAST_TYPE, setToast } from "@plane/propel/toast";',
        content
    )

    # Pattern 4: Type imports (general pattern)
    content = re.sub(
        r'<<<<<<< HEAD\nimport \{ ([^}]+) \} from "([^"]+)";\n=======\nimport type \{ \1 \} from "\2";\n>>>>>>> v1\.1\.0',
        r'import type { \1 } from "\2";',
        content
    )

    # Pattern 5: TabItem import separation
    content = re.sub(
        r'<<<<<<< HEAD\nimport \{ type TabItem, Tabs \} from "@plane/ui";\n=======\nimport \{ Tabs \} from "@plane/ui";\nimport type \{ TabItem \} from "@plane/ui";\n>>>>>>> v1\.1\.0',
        'import { Tabs } from "@plane/ui";\nimport type { TabItem } from "@plane/ui";',
        content
    )

    # Pattern 6: More complex Button imports with other components
    content = re.sub(
        r'<<<<<<< HEAD\n(.*?)\nimport \{ ([^}]*), Button, ([^}]*) \} from "@plane/ui";\n=======\n(.*?)\nimport \{ Button \} from "@plane/propel/button";\n(.*?)\nimport \{ \2, \3 \} from "@plane/ui";\n>>>>>>> v1\.1\.0',
        r'\4\nimport { Button } from "@plane/propel/button";\n\5\nimport { \2, \3 } from "@plane/ui";',
        content,
        flags=re.DOTALL
    )

    # Pattern 7: Icon changes (PenSquare to DraftIcon)
    content = re.sub(
        r'<<<<<<< HEAD\n(.*?)<PenSquare className="([^"]*)" />\n=======\n(.*?)<DraftIcon className="\2" />\n>>>>>>> v1\.1\.0',
        r'\3<DraftIcon className="\2" />',
        content,
        flags=re.DOTALL
    )

    # Pattern 8: UserActivityIcon to YourWorkIcon
    content = re.sub(
        r'<<<<<<< HEAD\nimport \{ UserActivityIcon \} from "@plane/propel/icons";\n(.*?)\n=======\nimport \{ YourWorkIcon \} from "@plane/propel/icons";\n(.*?)\n>>>>>>> v1\.1\.0',
        r'import { YourWorkIcon } from "@plane/propel/icons";\n\2\n',
        content,
        flags=re.DOTALL
    )

    # Pattern 9: Separated type and value imports (2 items)
    content = re.sub(
        r'<<<<<<< HEAD\nimport \{ ([^,}]+), ([^}]+) \} from "([^"]+)";\n=======\nimport type \{ \2 \} from "\3";\nimport \{ \1 \} from "\3";\n>>>>>>> v1\.1\.0',
        r'import type { \2 } from "\3";\nimport { \1 } from "\3";',
        content
    )

    # Pattern 10: Keep custom imports from HEAD when they're removed in v1.1.0
    # We want to preserve user customizations, so we keep the HEAD version
    content = re.sub(
        r'<<<<<<< HEAD\n(import \{ [^}]+ \} from "[^"]+";\n)=======\n>>>>>>> v1\.1\.0\n',
        r'\1',  # Keep the HEAD version (custom code)
        content
    )

    return content

def resolve_file_conflicts(file_path):
    """Resolve conflicts in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        resolved_content = resolve_import_conflicts(content)
        
        if resolved_content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(resolved_content)
            return True
        return False
        
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    print("Finding files with merge conflicts...")
    conflict_files = get_conflict_files()
    
    if not conflict_files:
        print("No merge conflicts found!")
        return
    
    print(f"Found {len(conflict_files)} files with conflicts")
    
    resolved_count = 0
    for file_path in conflict_files:
        if file_path.endswith(('.tsx', '.ts', '.jsx', '.js')):
            print(f"Processing {file_path}...")
            if resolve_file_conflicts(file_path):
                resolved_count += 1
                print(f"  ✓ Resolved conflicts in {file_path}")
            else:
                print(f"  - No automatic resolution for {file_path}")
    
    print(f"\nResolved conflicts in {resolved_count} files")
    
    # Check remaining conflicts
    remaining_conflicts = get_conflict_files()
    print(f"Remaining conflicts: {len(remaining_conflicts)} files")

if __name__ == "__main__":
    main()