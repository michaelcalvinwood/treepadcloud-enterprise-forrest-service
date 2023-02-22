#!/bin/bash

rsync -a --exclude "node_modules" . root@admin.treepadcloud.com:/home/forrest-service/
