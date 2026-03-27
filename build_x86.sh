docker buildx build --platform linux/amd64 -t numi-umami:latest-x86 .
docker tag numi-umami:latest-x86 git.felixholz.com/felix/numi-umami:latest-x86
docker push git.felixholz.com/felix/numi-umami:latest-x86