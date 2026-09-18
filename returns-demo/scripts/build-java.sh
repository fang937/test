#!/usr/bin/env bash
# 构建 Java 后端：自动定位 Maven（PATH → 项目 tools/ → 上级目录 tools/ → 自动下载）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-D:\\vscode\\java\\JDK}"
export PATH="$JAVA_HOME/bin:$PATH"

MVN="$(command -v mvn 2>/dev/null || true)"
if [ -z "$MVN" ]; then
  MVN="$(ls "$ROOT"/tools/apache-maven-*/bin/mvn ../tools/apache-maven-*/bin/mvn 2>/dev/null | head -1 || true)"
fi
if [ -z "$MVN" ]; then
  echo "未找到 Maven，自动下载到 $ROOT/tools/ ..."
  mkdir -p "$ROOT/tools"
  (
    cd "$ROOT/tools"
    curl -sfLo maven.zip https://dlcdn.apache.org/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip \
      || curl -sfLo maven.zip https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.zip
    unzip -qo maven.zip 2>/dev/null || /c/Windows/System32/tar.exe -xf maven.zip
    rm -f maven.zip
  )
  MVN="$(ls "$ROOT"/tools/apache-maven-*/bin/mvn | head -1)"
fi
# 转绝对路径，后续 cd backend-java 后仍可用
MVN="$(readlink -f "$MVN" 2>/dev/null || echo "$ROOT/${MVN#./}")"
echo "使用 Maven: $MVN"

cd backend-java
"$MVN" -q -B -DskipTests package
ls -lh target/returns-backend-*.jar
echo "构建完成。启动: java -jar backend-java/target/returns-backend-1.0.0.jar"
