TON_PATH = ~/Workspace/ton/blockchain

FIFT_LIB_PATH = $(TON_PATH)/crypto/fift/lib
FIFT_CONTRACT_PATH = dist/example.fif

FUNC_LIB_PATH = $(TON_PATH)/crypto/smartcont/stdlib.fc
FUNC_CONTRACT_PATH = contract/example.fc

all: compile boc

compile:
	func -AP -o $(FIFT_CONTRACT_PATH) $(FUNC_LIB_PATH) $(FUNC_CONTRACT_PATH)
	sed -i '$ s/}END>c/}END>c\ndup <s csr.\n2 boc+>B Bx. cr/' $(FIFT_CONTRACT_PATH)

boc:
	FIFTPATH=$(FIFT_LIB_PATH) fift -s $(FIFT_CONTRACT_PATH)
