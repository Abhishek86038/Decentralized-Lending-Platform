module MyModule::LendingPlatform {

    use aptos_framework::signer;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;

    /// Struct to track the lender's available funds.
    struct LenderVault has store, key {
        total_lent: u64,
    }

    /// Lenders deposit tokens into the platform.
    public fun lend_funds(lender: &signer, amount: u64) {
        let vault = if (exists<LenderVault>(signer::address_of(lender))) {
            borrow_global_mut<LenderVault>(signer::address_of(lender))
        } else {
            move_to(lender, LenderVault { total_lent: 0 });
            borrow_global_mut<LenderVault>(signer::address_of(lender))
        };

        let deposit = coin::withdraw<AptosCoin>(lender, amount);
        vault.total_lent = vault.total_lent + amount;
        coin::deposit<AptosCoin>(signer::address_of(lender), deposit);
    }

    /// Borrowers request tokens from a lender's vault.
    public fun borrow_funds(borrower: &signer, lender_address: address, amount: u64) acquires LenderVault {
        let vault = borrow_global_mut<LenderVault>(lender_address);
        assert!(vault.total_lent >= amount, 1); // Ensure sufficient funds

        let loan = coin::withdraw<AptosCoin>(&lender_address, amount);
        coin::deposit<AptosCoin>(signer::address_of(borrower), loan);
        vault.total_lent = vault.total_lent - amount;
    }
}
