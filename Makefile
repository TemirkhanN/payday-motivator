.PHONY: build-wasm
build-wasm:
	GOOS=js GOARCH=wasm go build -o ./wasm/payday-motivator.wasm