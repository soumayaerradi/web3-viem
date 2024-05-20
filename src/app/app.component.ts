import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getContract,
  http,
  parseAbi,
  parseUnits,
} from 'viem';
import { sepolia } from 'viem/chains';
import { ERC20_ABI } from './contract/ERC20.abi';

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'web3-viem';

  window: any = window;

  // wallet info
  isWalletConnected: boolean = false;
  walletAddress: `0x${string}` | undefined;
  network: string | undefined;
  chainId: string | undefined;

  // token info
  tokenInfo: TokenInfo | undefined;
  allowanceAmount: string = '0';
  approveAmount: string = '0';
  approveInProcess: boolean = false;
  approveConfirmed: boolean = false;
  approveError: string | undefined;

  // transfer
  transferAddress: `0x${string}` | undefined;
  transferAmount: string = '';
  transferInProcess: boolean = false;
  transferConfirmed: boolean = false;
  transferError: string | undefined;

  SEPOLIA_NETWORK = {
    chainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: {
      name: 'Sepolia',
      symbol: 'SEPOLIA',
      decimals: 18,
    },
    rpcUrls: ['https://ethereum-sepolia.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  };

  LINK_ADDRESS: `0x${string}` = '0x779877A7B0D9E8603169DdbD7836e478b4624789';
  APPROVE_CONTRACT: `0x${string}` = '0x83862cd294292Ffc7fB84fE10717Ba88C199Bc53';
  TRANSFER_ADDRESS: `0x${string}` = '0x87028e52304A3d58D6d48DC5a864815Ab70fB6F5';

  async connectWallet() {
    const [account] = await this.window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    console.log('Connected account:', account);

    this.walletAddress = account;
    this.isWalletConnected = true;
  }

  async checkNetwork() {
    const network = await this.window.ethereum.request({
      method: 'net_version',
    });

    this.network = network;
    console.log('Network:', network);

    const chainId = await this.window.ethereum.request({
      "method": "eth_chainId",
      "params": []
    });
    this.chainId = chainId;

    if (chainId === this.SEPOLIA_NETWORK.chainId) {
      console.log('Connected to Sepolia network');
    } else {
      console.log('Connected to unknown network: ', network);
    }
  }

  changeNetwork(chainId: string) {
    this.window.ethereum
      .request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainId }],
      })
      .then(() => {
        console.log('Switched to Sepolia network');
        this.checkNetwork();
      })
      .catch((error: any) => {
        console.error('Error switching network: ', error);
      });
  }

  async readTokenInfo() {
    console.log('Token');
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(this.window.ethereum),
    });
    console.log('Wallet Client:', walletClient);

    const addresses = await walletClient.getAddresses();
    console.log('Addresses:', addresses);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(sepolia.rpcUrls.default.http[0]),
    });

    const tokenName: string = await publicClient.readContract({
      address: this.LINK_ADDRESS,
      abi: parseAbi(['function name() view returns (string)']),
      functionName: 'name',
    });
    console.log('Token Name:', tokenName);

    const symbol: string = await publicClient.readContract({
      address: this.LINK_ADDRESS,
      abi: parseAbi(['function symbol() view returns (string)']),
      functionName: 'symbol',
    });
    console.log('Symbol:', symbol);

    const decimals: number = await publicClient.readContract({
      address: this.LINK_ADDRESS,
      abi: parseAbi(['function decimals() view returns (uint8)']),
      functionName: 'decimals',
    });
    console.log('Decimals:', decimals);

    const balance: bigint = await publicClient.readContract({
      address: this.LINK_ADDRESS,
      abi: ERC20_ABI, // alternatively, you can use parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [addresses[0]],
    });
    console.log('Balance BigInt:', balance);

    this.tokenInfo = {
      name: tokenName,
      symbol: symbol,
      decimals: decimals,
      balance: formatUnits(balance, decimals),
    };
  }

  async readTokenInfoMulticall() {
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(this.window.ethereum),
    });

    const addresses = await walletClient.getAddresses();

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(sepolia.rpcUrls.default.http[0]),
    });

    const abi = parseAbi([
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
    ]);

    const tokenInfo = await publicClient.multicall({
      contracts: [
        {
          address: this.LINK_ADDRESS,
          abi: abi,
          functionName: 'name',
        },
        {
          address: this.LINK_ADDRESS,
          abi: abi,
          functionName: 'symbol',
        },
        {
          address: this.LINK_ADDRESS,
          abi: abi,
          functionName: 'decimals',
        },
        {
          address: this.LINK_ADDRESS,
          abi: abi,
          functionName: 'balanceOf',
          args: [addresses[0]],
        },
      ],
    });

    console.log('Token Info:', tokenInfo);

    this.tokenInfo = {
      name: tokenInfo[0].status === 'success' ? tokenInfo[0].result : 'N/A',
      symbol: tokenInfo[1].status === 'success' ? tokenInfo[1].result : 'N/A',
      decimals: tokenInfo[2].status === 'success' ? tokenInfo[2].result : 0,
      balance:
        tokenInfo[3].status === 'success'
          ? formatUnits(
              tokenInfo[3].result,
              tokenInfo[2].status === 'success' ? tokenInfo[2].result : 0,
            )
          : 'N/A',
    };
  }

  async alternativereadTokenInfoMulticall() {
    if (!this.walletAddress) return;

    const publicClient = createPublicClient({
      batch: {
        multicall: true,
      },
      chain: sepolia,
      transport: http(),
    });

    const abi = parseAbi([
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function balanceOf(address) view returns (uint256)',
    ]);

    const contract = getContract({
      address: this.LINK_ADDRESS,
      abi: abi,
      client: publicClient,
    });

    // The below will send a single request to the RPC Provider.
    const [name, decimals, symbol, balance] = await Promise.all([
      contract.read['name'](),
      contract.read['decimals'](),
      contract.read['symbol'](),
      contract.read['balanceOf']([this.walletAddress]),
    ]);

    console.log({ name, decimals, symbol, balance });

    this.tokenInfo = {
      name: name,
      symbol: symbol,
      decimals: decimals,
      balance: formatUnits(balance, decimals),
    };
  }

  async readAllowance() {
    console.log('Allowance');
    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(this.window.ethereum),
    });

    const [account] = await walletClient.getAddresses();
    console.log('Account:', account);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(sepolia.rpcUrls.default.http[0]),
    });

    const allowance: bigint = await publicClient.readContract({
      address: this.LINK_ADDRESS,
      abi: parseAbi([
        'function allowance(address, address) view returns (uint256)',
      ]),
      functionName: 'allowance',
      args: [account, this.APPROVE_CONTRACT],
    });

    console.log('Allowance BigInt:', allowance);
    console.log('Allowance:', formatUnits(allowance, 18));
    this.allowanceAmount = formatUnits(
      allowance,
      this.tokenInfo?.decimals || 18,
    );
  }

  async approveTokens() {
    console.log('Approve');
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(this.SEPOLIA_NETWORK.rpcUrls[0]),
    });

    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(this.window.ethereum),
    });

    const addresses = await walletClient.getAddresses();
    console.log('Addresses:', addresses);

    try {
      const request = await publicClient.simulateContract({
        address: this.LINK_ADDRESS,
        abi: parseAbi(['function approve(address, uint256)']),
        functionName: 'approve',
        args: [
          this.APPROVE_CONTRACT,
          parseUnits(this.approveAmount, this.tokenInfo?.decimals || 18),
        ],
        account: addresses[0],
      });
      console.log('Request:', request);

      const hash = await walletClient.writeContract(request.request);
      console.log('Hash:', hash);

      this.approveInProcess = true;

      const transactionReceipt = await publicClient.waitForTransactionReceipt({
        hash: hash,
      });
      console.log('Transaction Receipt:', transactionReceipt);

      this.approveInProcess = false;
      this.approveConfirmed = true;
    } catch (error: any) {
      console.error('Error approving tokens:', error);
      this.approveError = error.message.split('.')[0];
    }
  }

  async transferTokens() {
    console.log('Transfer');
    if (!this.transferAddress || !this.transferAmount) return;
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(this.SEPOLIA_NETWORK.rpcUrls[0]),
    });

    const walletClient = createWalletClient({
      chain: sepolia,
      transport: custom(this.window.ethereum),
    });

    const addresses = await walletClient.getAddresses();

    try {
      const request = await publicClient.simulateContract({
        address: this.LINK_ADDRESS,
        abi: parseAbi(['function transfer(address, uint256)']),
        functionName: 'transfer',
        args: [
          this.transferAddress,
          parseUnits(this.transferAmount, this.tokenInfo?.decimals || 18),
        ],
        account: addresses[0],
      });
      console.log('Request:', request);

      const hash = await walletClient.writeContract(request.request);
      console.log('Hash:', hash);

      this.transferInProcess = true;

      const transactionReceipt = await publicClient.waitForTransactionReceipt({
        hash: hash,
      });
      console.log('Transaction Receipt:', transactionReceipt);

      this.transferInProcess = false;
      this.transferConfirmed = true;
    } catch (error: any) {
      console.error('Error transferring tokens:', error);
      this.transferError = error.message.split('.')[0];
    }
  }
}
