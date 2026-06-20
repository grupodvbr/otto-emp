@echo off
title Listar Microfones - OTTO
color 0B
ffmpeg -list_devices true -f dshow -i dummy
pause


