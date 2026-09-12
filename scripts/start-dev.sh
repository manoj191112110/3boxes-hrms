#!/bin/bash
cd /home/z/my-project
export POSTGRES_PRISMA_URL='postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
export POSTGRES_URL='postgresql://neondb_owner:npg_pxZd8woKe4WB@ep-blue-fire-aqk8jxd2.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
npx next dev -p 3111 > /tmp/devserver.log 2>&1
