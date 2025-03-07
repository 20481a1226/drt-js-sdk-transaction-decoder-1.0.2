import { bech32 } from "bech32";

export class TransactionDecoder {
  getTransactionMetadata(transaction: TransactionToDecode): TransactionMetadata {
    const metadata = this.getNormalTransactionMetadata(transaction);

    const dcdtMetadata = this.getDcdtTransactionMetadata(metadata);
    if (dcdtMetadata) {
      return dcdtMetadata;
    }

    const nftMetadata = this.getNftTransferMetadata(metadata);
    if (nftMetadata) {
      return nftMetadata;
    }

    const multiMetadata = this.getMultiTransferMetadata(metadata);
    if (multiMetadata) {
      return multiMetadata;
    }

    return metadata;
  }

  private getNormalTransactionMetadata(transaction: TransactionToDecode): TransactionMetadata {
    const metadata = new TransactionMetadata();
    metadata.sender = transaction.sender;
    metadata.receiver = transaction.receiver;
    metadata.value = BigInt(transaction.value);

    if (transaction.data) {
      const decodedData = this.base64Decode(transaction.data);

      const dataComponents = decodedData.split('@');

      const args = dataComponents.slice(1);
      if (args.every((x: any) => this.isSmartContractArgument(x))) {
        metadata.functionName = dataComponents[0];
        metadata.functionArgs = args;
      }

      if (metadata.functionName === 'relayedTx' && metadata.functionArgs && metadata.functionArgs.length === 1) {
        try {
          const relayedTransaction = JSON.parse(this.hexToString(metadata.functionArgs[0]));
          relayedTransaction.value = relayedTransaction.value.toString();
          relayedTransaction.sender = this.bech32Encode(this.base64ToHex(relayedTransaction.sender));
          relayedTransaction.receiver = this.bech32Encode(this.base64ToHex(relayedTransaction.receiver));
          return this.getNormalTransactionMetadata(relayedTransaction);
        } catch (error) {
          // nothing special
        }
      }

      if (metadata.functionName === 'relayedTxV2' && metadata.functionArgs && metadata.functionArgs.length === 4) {
        try {
          const relayedTransaction = new TransactionToDecode();
          relayedTransaction.sender = transaction.receiver;
          relayedTransaction.receiver = this.bech32Encode(metadata.functionArgs[0]);
          relayedTransaction.data = this.base64Encode(this.hexToString(metadata.functionArgs[2]));
          relayedTransaction.value = '0';

          return this.getNormalTransactionMetadata(relayedTransaction);
        } catch (error) {
          // nothing special
        }
      }
    }

    return metadata;
  }

  private getMultiTransferMetadata(metadata: TransactionMetadata): TransactionMetadata | undefined {
    if (metadata.sender !== metadata.receiver) {
      return undefined;
    }

    if (metadata.functionName !== 'MultiDCDTNFTTransfer') {
      return undefined;
    }

    const args = metadata.functionArgs;
    if (!args) {
      return undefined;
    }

    if (args.length < 3) {
      return undefined;
    }

    if (!this.isAddressValid(args[0])) {
      return undefined;
    }

    const receiver = this.bech32Encode(args[0]);
    const transferCount = this.hexToNumber(args[1]);

    const result = new TransactionMetadata();
    if (!result.transfers) {
      result.transfers = [];
    }

    let index = 2;
    for (let i = 0; i < transferCount; i++) {
      const identifier = this.hexToString(args[index++]);
      const nonce = args[index++];
      const value = this.hexToBigInt(args[index++]);

      if (nonce) {
        result.transfers.push({
          value,
          properties: {
            collection: identifier,
            identifier: `${identifier}-${nonce}`,
          },
        });
      } else {
        result.transfers.push({
          value,
          properties: {
            token: identifier,
          },
        });
      }
    }

    result.sender = metadata.sender;
    result.receiver = receiver;

    if (args.length > index) {
      result.functionName = this.hexToString(args[index++]);
      result.functionArgs = args.slice(index++);
    }

    return result;
  }

  private getNftTransferMetadata(metadata: TransactionMetadata): TransactionMetadata | undefined {
    if (metadata.sender !== metadata.receiver) {
      return undefined;
    }

    if (metadata.functionName !== 'DCDTNFTTransfer') {
      return undefined;
    }

    const args = metadata.functionArgs;
    if (!args) {
      return undefined;
    }

    if (args.length < 4) {
      return undefined;
    }

    if (!this.isAddressValid(args[3])) {
      return undefined;
    }

    const collectionIdentifier = this.hexToString(args[0]);
    const nonce = args[1];
    const value = this.hexToBigInt(args[2]);
    const receiver = this.bech32Encode(args[3]);

    const result = new TransactionMetadata();
    result.sender = metadata.sender;
    result.receiver = receiver;
    result.value = value;

    if (args.length > 4) {
      result.functionName = this.hexToString(args[4]);
      result.functionArgs = args.slice(5);
    }

    result.transfers = [{
      value,
      properties: {
        collection: collectionIdentifier,
        identifier: `${collectionIdentifier}-${nonce}`,
      },
    }];

    return result;
  }

  private base64Encode(str: string) {
    return Buffer.from(str).toString('base64');
  }

  private base64Decode(str: string): string {
    return Buffer.from(str, 'base64').toString('binary');
  }

  private hexToNumber(hex: string): number {
    return parseInt(hex, 16);
  }

  private getDcdtTransactionMetadata(metadata: TransactionMetadata): TransactionMetadata | undefined {
    if (metadata.functionName !== 'DCDTTransfer') {
      return undefined;
    }

    const args = metadata.functionArgs;
    if (!args) {
      return undefined;
    }

    if (args.length < 2) {
      return undefined;
    }

    const tokenIdentifier = this.hexToString(args[0]);
    const value = this.hexToBigInt(args[1]);

    const result = new TransactionMetadata();
    result.sender = metadata.sender;
    result.receiver = metadata.receiver;

    if (args.length > 2) {
      result.functionName = this.hexToString(args[2]);
      result.functionArgs = args.slice(3);
    }

    result.transfers = [{
      value,
      properties: {
        identifier: tokenIdentifier,
      },
    }];

    result.value = value;

    return result;
  }

  private bech32Encode(address: string): string {
    const pubKey = Buffer.from(address, "hex");
    const words = bech32.toWords(pubKey);
    return bech32.encode('drt', words);
  }

  private isAddressValid(address: string): boolean {
    return Buffer.from(address, "hex").length == 32;
  }

  private isSmartContractArgument(arg: string): boolean {
    if (!this.isHex(arg)) {
      return false;
    }

    if (arg.length % 2 !== 0) {
      return false;
    }

    return true;
  }

  private isHex(value: string) {
    return new RegExp(/[^a-f0-9]/gi).test(value) === false;
  }

  private base64ToHex(str: string): string {
    return Buffer.from(str, 'base64').toString('hex');
  }

  private hexToString(hex: string): string {
    return Buffer.from(hex, 'hex').toString('ascii');
  }

  private hexToBigInt(hex: string): BigInt {
    if (!hex) {
      return BigInt(0);
    }

    return BigInt('0x' + hex);
  }
}

export class TransactionToDecode {
  sender: string = '';
  receiver: string = '';
  data: string = '';
  value: string = '0';
}

export class TransactionMetadata {
  sender: string = '';
  receiver: string = '';
  value: BigInt = BigInt(0);
  functionName?: string;
  functionArgs?: string[];

  transfers?: TransactionMetadataTransfer[];
}

export class TransactionMetadataTransfer {
  properties?: TokenTransferProperties;

  value: BigInt = BigInt(0);
}

export class TokenTransferProperties {
  token?: string;
  collection?: string;
  identifier?: string;
}
