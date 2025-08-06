# import subprocess
# import shlex
# import os

# with open('Information.txt', 'r', encoding='utf-8-sig') as f:
#     cmd = f.read().strip()

# args = shlex.split(cmd, posix=False)
# java_path = args[0].strip('"')
# params = args[1:]

# print("Java path:", java_path)
# print("Параметров:", len(params))

# result = subprocess.run([java_path] + params, capture_output=True, text=True)

# print("STDOUT:\n", result.stdout)
# print("STDERR:\n", result.stderr)
# print("Return code:", result.returncode)


import subprocess

java_path = r"E:\Projects\melorium-launcher\gametest\java_versions\zulu21.42.19-ca-jre21.0.7-win_x64\bin\javaw.exe"
args_file = "@args.txt"  # Можно указать полный путь, если нужно

result = subprocess.run([java_path, args_file], capture_output=True, text=True)

print("STDOUT:\n", result.stdout)
print("STDERR:\n", result.stderr)
print("Return code:", result.returncode)


