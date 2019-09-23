import { Units as EthUnits, Wei } from '@emeraldplatform/eth';
import BigNumber from 'bignumber.js';
import { IUnits, Units } from '../../Units';
import { ITx, targetFromNumber, TxTarget, ValidationResult } from './types';

export enum TransferType {
  STANDARD,
  DELEGATE
}

export function transferFromNumber (i: number): TransferType {
  if (i === TransferType.DELEGATE.valueOf()) {
    return TransferType.DELEGATE;
  }
  return TransferType.STANDARD;
}

export interface IERC20TxDetails {
  from?: string;
  to?: string;
  erc20: string;
  target: TxTarget;
  amount: IUnits;
  totalTokenBalance?: IUnits;
  totalEtherBalance?: Wei;
  gasPrice: Wei;
  gas: BigNumber;
  transferType: TransferType;
}

export interface IERC20TxDetailsPlain {
  from?: string;
  to?: string;
  erc20: string;
  target: number;
  amount: string;
  tokenDecimals: number;
  totalTokenBalance?: string;
  totalEtherBalance?: string;
  gasPrice: string;
  gas: number;
  transferType: number;
}

const TxDefaults: IERC20TxDetails = {
  erc20: '',
  target: TxTarget.MANUAL,
  amount: Units.ZERO,
  gasPrice: Wei.ZERO,
  gas: new BigNumber(21000),
  transferType: TransferType.STANDARD
};

function toPlainDetails (tx: IERC20TxDetails): IERC20TxDetailsPlain {
  return {
    from: tx.from,
    to: tx.to,
    erc20: tx.erc20,
    target: tx.target.valueOf(),
    amount: tx.amount.amount,
    tokenDecimals: tx.amount.decimals,
    totalTokenBalance: tx.totalTokenBalance == null ? undefined : tx.totalTokenBalance.amount,
    totalEtherBalance: tx.totalEtherBalance == null ? undefined : tx.totalEtherBalance.toString(EthUnits.WEI, 0, false),
    gasPrice: tx.gasPrice.toString(EthUnits.WEI, 0, false),
    gas: tx.gas.toNumber(),
    transferType: tx.transferType.valueOf()
  };
}

function fromPlainDetails (plain: IERC20TxDetailsPlain): IERC20TxDetails {
  return {
    amount: new Units(plain.amount, plain.tokenDecimals),
    erc20: plain.erc20,
    from: plain.from,
    target: targetFromNumber(plain.target),
    to: plain.to,
    totalTokenBalance: plain.totalTokenBalance == null ? undefined
      : new Units(plain.totalTokenBalance, plain.tokenDecimals),
    totalEtherBalance: plain.totalEtherBalance == null ? undefined : new Wei(plain.totalEtherBalance, EthUnits.WEI),
    gasPrice: new Wei(plain.gasPrice, EthUnits.WEI),
    gas: new BigNumber(plain.gas),
    transferType: transferFromNumber(plain.transferType)
  };
}

export class CreateERC20Tx implements IERC20TxDetails, ITx {

  public static fromPlain (details: IERC20TxDetailsPlain): CreateERC20Tx {
    return new CreateERC20Tx(fromPlainDetails(details));
  }
  public from?: string;
  public to?: string;
  public erc20: string;
  public target: TxTarget;
  public amount: IUnits;
  public totalTokenBalance?: IUnits;
  public totalEtherBalance?: Wei;
  public gasPrice: Wei;
  public gas: BigNumber;
  public transferType: TransferType;

  constructor (source?: IERC20TxDetails) {
    if (!source) {
      source = TxDefaults;
    }
    this.from = source.from;
    this.to = source.to;
    this.erc20 = source.erc20;
    this.target = source.target;
    this.amount = source.amount;
    this.totalTokenBalance = source.totalTokenBalance;
    this.totalEtherBalance = source.totalEtherBalance;
    this.gasPrice = source.gasPrice;
    this.gas = source.gas;
    this.transferType = source.transferType;
  }

  public getTotalBalance (): IUnits {
    return this.totalTokenBalance ? this.totalTokenBalance : new Units(0, this.amount.decimals);
  }

  public getAmount (): IUnits {
    return this.amount;
  }

  public setAmount (a: IUnits) {
    this.amount = a;
  }

  public dump (): IERC20TxDetailsPlain {
    return toPlainDetails(this);
  }

  public setFrom (from: string, tokenBalance: IUnits, etherBalance: Wei) {
    this.from = from;
    this.totalTokenBalance = tokenBalance;
    this.totalEtherBalance = etherBalance;
  }

  public validate (): ValidationResult {
    if (this.from == null || this.totalTokenBalance == null || this.totalEtherBalance == null) {
      return ValidationResult.NO_FROM;
    }
    if (this.to == null) {
      return ValidationResult.NO_TO;
    }
    if (this.totalTokenBalance && this.getTotal().isGreaterThan(this.totalTokenBalance)) {
      return ValidationResult.INSUFFICIENT_TOKEN_FUNDS;
    }
    if (this.getFees().isGreaterThan(this.totalEtherBalance)) {
      return ValidationResult.INSUFFICIENT_FUNDS;
    }
    return ValidationResult.OK;
  }

  public getTotal (): IUnits {
    return this.amount;
  }

  public getChange (): (IUnits | null) {
    if (this.totalTokenBalance == null) {
      return null;
    }
    return this.totalTokenBalance.minus(this.getTotal());
  }

  public getFeesChange (): (Wei | null) {
    if (this.totalEtherBalance == null) {
      return null;
    }
    return this.totalEtherBalance.minus(this.getFees());
  }

  public getFees (): Wei {
    return new Wei(this.gas.multipliedBy(this.gasPrice.value));
  }

  public rebalance (): boolean {
    if (this.target === TxTarget.SEND_ALL) {
      if (this.totalTokenBalance == null) {
        return false;
      }
      this.amount = this.totalTokenBalance;
      return true;
    }
    return true;
  }

  public debug (): string {
    const change = this.getChange();
    return `Send ${this.from} -> ${this.to} of ${JSON.stringify(this.amount)} using ${this.gas} at ${this.gasPrice.toString(EthUnits.MWEI, undefined, true)}.\n` +
      `Total to send: ${this.getTotal()} of token, pay ${this.getFees()} of Ether fees,` +
      `account has ${this.totalTokenBalance}, will have ${change}`;

  }
}
