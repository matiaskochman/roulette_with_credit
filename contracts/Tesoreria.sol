// File: contracts/Tesoreria.sol
pragma solidity ^0.8.17; // Standardize version

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// Removed Ruleta import as it's not directly needed for types here, only for address logic
import "hardhat/console.sol";

contract Tesoreria is Ownable { // Inherit Ownable
    IERC20 private stableCoin;
    IERC20 private ruletaToken;
    address public ruletaContractAddress; // Keep track of Ruleta contract
    uint256 public totalDeposits;

    // Event Placeholders
    event DepositReceived(address indexed player, uint256 amount);
    event WinningsPaid(address indexed recipient, uint256 usdtAmount, uint256 ruletaTokenAmount);
    event HouseProfitWithdrawn(address indexed recipient, uint256 usdtAmount, uint256 ruletaTokenAmount);
    event RuletaContractSet(address indexed ruletaAddress);

    // Constructor - Deployer automatically becomes the owner
    constructor(address _stableCoin, address _ruletaToken) {
        require(_stableCoin != address(0), "Stablecoin address cannot be zero");
        require(_ruletaToken != address(0), "RuletaToken address cannot be zero");
        stableCoin = IERC20(_stableCoin);
        ruletaToken = IERC20(_ruletaToken);
    }

    // Allow the current owner (deployer) to set the Ruleta contract address ONCE
    function setRuletaContract(address _ruletaContractAddress) public onlyOwner {
        require(_ruletaContractAddress != address(0), "Ruleta address cannot be zero");
        require(ruletaContractAddress == address(0), "Ruleta address already set"); // Prevent changing it
        ruletaContractAddress = _ruletaContractAddress;
        emit RuletaContractSet(_ruletaContractAddress);
    }

    // Modifier to restrict calls only to the set Ruleta contract
    modifier onlyRuletaContract() {
        require(msg.sender == ruletaContractAddress, "Only the Ruleta contract can call this function");
        _;
    }

    // Deposit function restricted ONLY to the Ruleta Contract
    function depositFromPlayer(address player, uint256 amount) external onlyRuletaContract {
      require(player != address(0), "Player address cannot be zero");
      require(amount > 0, "Deposit amount must be greater than zero");

      // This transfer relies on the player having previously approved this Tesoreria contract
      uint256 initialBalance = stableCoin.balanceOf(address(this));
      require(stableCoin.transferFrom(player, address(this), amount), "Stablecoin transferFrom failed");
      uint256 finalBalance = stableCoin.balanceOf(address(this));
      require(finalBalance == initialBalance + amount, "Deposit amount mismatch"); // Sanity check

      totalDeposits += amount;
      emit DepositReceived(player, amount);
    }

    // Player winnings withdrawal, restricted ONLY to the Ruleta Contract
    function withdrawWinnings(address recipient, uint256 amount) external onlyRuletaContract {
        require(recipient != address(0), "Recipient address cannot be zero");
        require(amount > 0, "Withdrawal amount must be positive");

        uint256 usdtBalance = stableCoin.balanceOf(address(this));
        uint256 rbtBalance = ruletaToken.balanceOf(address(this));
        uint256 usdtToSend = 0;
        uint256 rbtToSend = 0;

        if (amount <= usdtBalance) {
            // Sufficient USDT funds
            usdtToSend = amount;
            require(stableCoin.transfer(recipient, usdtToSend), "Transfer stablecoin full failed");
        } else {
            // Insufficient USDT, use all available USDT and top up with RBT
            usdtToSend = usdtBalance;
            rbtToSend = amount - usdtBalance;

            require(rbtBalance >= rbtToSend, "Insufficient combined funds (USDT + RBT)");

            if (usdtToSend > 0) {
                 require(stableCoin.transfer(recipient, usdtToSend), "Transfer stablecoin partial failed");
            }
            require(ruletaToken.transfer(recipient, rbtToSend), "Transfer ruletatoken partial failed");
        }

        emit WinningsPaid(recipient, usdtToSend, rbtToSend);
    }

     // House profit withdrawal, restricted to the Tesoreria owner (deployer)
     function withdrawHouseProfits(uint256 usdtAmount, uint256 ruletaTokenAmount) external onlyOwner {
         // It's complex to determine exact "profit" on-chain easily.
         // This function simply allows the owner to withdraw available funds.
         // Ensure off-chain accounting is done correctly to avoid withdrawing player funds.
         uint256 currentUsdt = stableCoin.balanceOf(address(this));
         uint256 currentRbt = ruletaToken.balanceOf(address(this));

         if (usdtAmount > 0) {
             require(currentUsdt >= usdtAmount, "Insufficient house USDT funds");
             require(stableCoin.transfer(msg.sender, usdtAmount), "House USDT withdrawal failed");
         }
          if (ruletaTokenAmount > 0) {
             require(currentRbt >= ruletaTokenAmount, "Insufficient house RBT funds");
             require(ruletaToken.transfer(msg.sender, ruletaTokenAmount), "House RBT withdrawal failed");
         }
         emit HouseProfitWithdrawn(msg.sender, usdtAmount, ruletaTokenAmount);
     }

     // Function for owner to add more RuletaTokens if needed (e.g., initial supply or top-up)
     function depositRuletaTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        require(ruletaToken.transferFrom(msg.sender, address(this), amount), "RBT deposit failed");
     }
}