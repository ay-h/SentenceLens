All PowerShell commands must use UTF-8 encoding.

Prefix commands with:

[Console]::OutputEncoding=[System.Text.Encoding]::UTF8

Example:

powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ./script.ps1"