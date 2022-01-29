TON_PATH = ~/Workspace/ton/blockchain
FIFTPATH = $(TON_PATH)/crypto/fift/lib

all: compile boc

compile:
	func -AP -o dist/lottery-compiled.fif $(TON_PATH)/crypto/smartcont/stdlib.fc contracts/lottery.fc
	sed -i '$ s/}END>c/}END>c\ndup <s csr.\n2 boc+>B Bx. cr/' dist/lottery-compiled.fif

boc:
	FIFTPATH=$(FIFTPATH) fift -s dist/lottery-compiled.fif
