// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Zero-fee MUSD invoices; payments settle directly to the creator.
contract MezoPayInvoices {
    struct Invoice {
        uint256 id;
        address creator;
        address payer;
        uint256 amount;
        string title;
        string memo;
        bool paid;
        uint256 createdAt;
        uint256 paidAt;
    }

    address public immutable musdToken;
    uint256 private invoiceCount;
    mapping(uint256 => Invoice) private invoices;
    mapping(address => uint256[]) private creatorInvoices;
    mapping(address => uint256[]) private payerInvoices;
    bool private paying;

    event InvoiceCreated(uint256 indexed id, address indexed creator, uint256 amount, string title);
    event InvoicePaid(uint256 indexed id, address indexed creator, address indexed payer, uint256 amount);

    constructor(address _musdToken) {
        require(_musdToken != address(0), "Invalid MUSD token");
        musdToken = _musdToken;
    }

    function createInvoice(uint256 amount, string calldata title, string calldata memo)
        external returns (uint256 invoiceId)
    {
        require(amount > 0, "Amount must be positive");
        require(bytes(title).length > 0, "Title is required");
        invoiceId = ++invoiceCount;
        invoices[invoiceId] = Invoice({
            id: invoiceId,
            creator: msg.sender,
            payer: address(0),
            amount: amount,
            title: title,
            memo: memo,
            paid: false,
            createdAt: block.timestamp,
            paidAt: 0
        });
        creatorInvoices[msg.sender].push(invoiceId);
        emit InvoiceCreated(invoiceId, msg.sender, amount, title);
    }

    function payInvoice(uint256 invoiceId) external {
        require(!paying, "Reentrant payment");
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.creator != address(0), "Invoice does not exist");
        require(!invoice.paid, "Invoice already paid");
        paying = true;
        require(
            IERC20(musdToken).transferFrom(msg.sender, invoice.creator, invoice.amount),
            "MUSD transfer failed"
        );
        invoice.paid = true;
        invoice.payer = msg.sender;
        invoice.paidAt = block.timestamp;
        payerInvoices[msg.sender].push(invoiceId);
        paying = false;
        emit InvoicePaid(invoiceId, invoice.creator, msg.sender, invoice.amount);
    }

    function getInvoice(uint256 id) external view returns (Invoice memory) {
        require(invoices[id].creator != address(0), "Invoice does not exist");
        return invoices[id];
    }

    function getCreatorInvoices(address creator) external view returns (uint256[] memory) {
        return creatorInvoices[creator];
    }

    function getPayerInvoices(address payer) external view returns (uint256[] memory) {
        return payerInvoices[payer];
    }

    function totalInvoices() external view returns (uint256) {
        return invoiceCount;
    }
}
