import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getTransactions, updateTransaction, getBudgets, updateBudget, getLoans, updateLoan, getInvestments, updateInvestment } from './api';
import currencyService, { Currency } from './currencyService';
import { useAlert } from '@/components/AlertProvider';

export interface ConversionTask {
  id: string;
  type: 'all' | 'transactions' | 'budgets' | 'loans' | 'investments';
  fromCurrency: string;
  toCurrency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  error?: string;
  itemsToProcess: number;
  itemsProcessed: number;
}

export interface ConversionQueue {
  tasks: ConversionTask[];
  isProcessing: boolean;
}

class CurrencyConversionManager {
  private static instance: CurrencyConversionManager;
  private queue: ConversionQueue = { tasks: [], isProcessing: false };
  private readonly QUEUE_STORAGE_KEY = 'currency_conversion_queue';
  private isOnline = true;
  private netInfoUnsubscribe?: () => void;

  public static getInstance(): CurrencyConversionManager {
    if (!CurrencyConversionManager.instance) {
      CurrencyConversionManager.instance = new CurrencyConversionManager();
    }
    return CurrencyConversionManager.instance;
  }

  constructor() {
    this.initializeNetworkListener();
    this.loadQueue();
  }

  private initializeNetworkListener() {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected || false;
      
      // If we just came back online and have pending tasks, process them
      if (wasOffline && this.isOnline && this.queue.tasks.length > 0) {
        console.log('Network restored, processing pending currency conversions...');
        this.processQueue();
      }
    });
  }

  private async loadQueue(): Promise<void> {
    try {
      const storedQueue = await AsyncStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
      }
    } catch (error) {
      console.error('Error loading conversion queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving conversion queue:', error);
    }
  }

  public async requestCurrencyChange(
    fromCurrency: string, 
    toCurrency: string, 
    showConfirmation: boolean = true
  ): Promise<boolean> {
    if (!this.isOnline) {
      // Queue the task for when we're back online
      const task: ConversionTask = {
        id: Date.now().toString(),
        type: 'all',
        fromCurrency,
        toCurrency,
        status: 'pending',
        createdAt: new Date().toISOString(),
        itemsToProcess: 0,
        itemsProcessed: 0
      };

      this.queue.tasks.push(task);
      await this.saveQueue();

      // Show offline message
      console.log('Offline mode - conversion queued');
      return false;
    }

    if (showConfirmation) {
      return new Promise((resolve) => {
        // This will be handled by the component calling this method
        resolve(true);
      });
    }

    return this.performCurrencyConversion(fromCurrency, toCurrency);
  }

  public async performCurrencyConversion(
    fromCurrency: string, 
    toCurrency: string
  ): Promise<boolean> {
    try {
      const task: ConversionTask = {
        id: Date.now().toString(),
        type: 'all',
        fromCurrency,
        toCurrency,
        status: 'processing',
        createdAt: new Date().toISOString(),
        itemsToProcess: 0,
        itemsProcessed: 0
      };

      this.queue.tasks.push(task);
      this.queue.isProcessing = true;
      await this.saveQueue();

      // Get all data to convert
      const [transactions, budgets, loans, investments] = await Promise.all([
        this.getTransactionsForConversion(),
        this.getBudgetsForConversion(),
        this.getLoansForConversion(),
        this.getInvestmentsForConversion()
      ]);

      const totalItems = transactions.length + budgets.length + loans.length + investments.length;
      task.itemsToProcess = totalItems;
      await this.saveQueue();

      // Convert transactions
      await this.convertTransactions(transactions, fromCurrency, toCurrency, task);
      
      // Convert budgets
      await this.convertBudgets(budgets, fromCurrency, toCurrency, task);
      
      // Convert loans
      await this.convertLoans(loans, fromCurrency, toCurrency, task);
      
      // Convert investments
      await this.convertInvestments(investments, fromCurrency, toCurrency, task);

      task.status = 'completed';
      task.processedAt = new Date().toISOString();
      this.queue.isProcessing = false;
      await this.saveQueue();

      console.log(`Currency conversion completed: ${task.itemsProcessed}/${task.itemsToProcess} items`);
      return true;

    } catch (error) {
      console.error('Error performing currency conversion:', error);
      this.queue.isProcessing = false;
      await this.saveQueue();
      return false;
    }
  }

  private async getTransactionsForConversion() {
    try {
      const response = await getTransactions();
      return response?.data?.transactions || [];
    } catch (error) {
      console.error('Error fetching transactions for conversion:', error);
      return [];
    }
  }

  private async getBudgetsForConversion() {
    try {
      const response = await getBudgets({});
      return response?.data?.budgets || [];
    } catch (error) {
      console.error('Error fetching budgets for conversion:', error);
      return [];
    }
  }

  private async getLoansForConversion() {
    try {
      const response = await getLoans({});
      return response?.data?.loans || [];
    } catch (error) {
      console.error('Error fetching loans for conversion:', error);
      return [];
    }
  }

  private async getInvestmentsForConversion() {
    try {
      const response = await getInvestments();
      return response?.data?.investments || [];
    } catch (error) {
      console.error('Error fetching investments for conversion:', error);
      return [];
    }
  }

  private async convertTransactions(
    transactions: any[], 
    fromCurrency: string, 
    toCurrency: string, 
    task: ConversionTask
  ) {
    // Use bulk conversion for efficiency
    const transactionsToConvert = transactions.filter(t => t.currency === fromCurrency);
    if (transactionsToConvert.length === 0) return;

    try {
      // Prepare bulk conversion data
      const bulkItems = transactionsToConvert.map(transaction => ({
        item_id: transaction.id,
        item_type: 'transaction',
        amount: transaction.amount,
        from_currency: fromCurrency,
        to_currency: toCurrency
      }));

      // Use bulk conversion from currency service
      const results = await currencyService.convertBulk(bulkItems);

      // Process results and update transactions
      for (const result of results) {
        if (result.success) {
          const transaction = transactionsToConvert.find(t => t.id === result.item_id);
          if (transaction) {
            await updateTransaction(transaction.id, {
              ...transaction,
              amount: result.converted_amount,
              currency: toCurrency
            });
            task.itemsProcessed++;
          }
        } else {
          console.error(`Failed to convert transaction ${result.item_id}:`, result.error);
        }
      }
      
      await this.saveQueue();
    } catch (error) {
      console.error('Bulk conversion failed, falling back to individual conversions:', error);
      
      // Fallback to individual conversions
      for (const transaction of transactionsToConvert) {
        try {
          const convertedAmount = await currencyService.convertCurrency(
            transaction.amount, 
            fromCurrency, 
            toCurrency
          );

          await updateTransaction(transaction.id, {
            ...transaction,
            amount: convertedAmount,
            currency: toCurrency
          });

          task.itemsProcessed++;
          await this.saveQueue();
        } catch (error) {
          console.error(`Error converting transaction ${transaction.id}:`, error);
        }
      }
    }
  }

  private async convertBudgets(
    budgets: any[], 
    fromCurrency: string, 
    toCurrency: string, 
    task: ConversionTask
  ) {
    const budgetsToConvert = budgets.filter(b => b.currency === fromCurrency);
    if (budgetsToConvert.length === 0) return;

    try {
      // Prepare bulk conversion data for budget amounts
      const bulkItems = budgetsToConvert.flatMap(budget => [
        {
          item_id: `${budget.id}_amount`,
          item_type: 'budget_amount',
          amount: budget.amount,
          from_currency: fromCurrency,
          to_currency: toCurrency
        },
        ...(budget.spent_amount ? [{
          item_id: `${budget.id}_spent`,
          item_type: 'budget_spent',
          amount: budget.spent_amount,
          from_currency: fromCurrency,
          to_currency: toCurrency
        }] : [])
      ]);

      const results = await currencyService.convertBulk(bulkItems);

      // Process results and update budgets
      const resultMap = new Map(results.map(r => [r.item_id, r]));
      
      for (const budget of budgetsToConvert) {
        const amountResult = resultMap.get(`${budget.id}_amount`);
        const spentResult = resultMap.get(`${budget.id}_spent`);

        if (amountResult?.success) {
          const updateData = {
            ...budget,
            amount: amountResult.converted_amount,
            currency: toCurrency
          };

          if (spentResult?.success) {
            updateData.spent_amount = spentResult.converted_amount;
          }

          await updateBudget(budget.id, updateData);
          task.itemsProcessed++;
        }
      }
      
      await this.saveQueue();
    } catch (error) {
      console.error('Bulk budget conversion failed, falling back to individual conversions:', error);
      
      // Fallback to individual conversions
      for (const budget of budgetsToConvert) {
        try {
          const convertedAmount = await currencyService.convertCurrency(
            budget.amount, 
            fromCurrency, 
            toCurrency
          );

          const convertedSpent = budget.spent_amount ? 
            await currencyService.convertCurrency(budget.spent_amount, fromCurrency, toCurrency) : 
            0;

          await updateBudget(budget.id, {
            ...budget,
            amount: convertedAmount,
            spent_amount: convertedSpent,
            currency: toCurrency
          });

          task.itemsProcessed++;
          await this.saveQueue();
        } catch (error) {
          console.error(`Error converting budget ${budget.id}:`, error);
        }
      }
    }
  }

  private async convertLoans(
    loans: any[], 
    fromCurrency: string, 
    toCurrency: string, 
    task: ConversionTask
  ) {
    for (const loan of loans) {
      try {
        if (loan.currency === fromCurrency) {
          const convertedAmount = await currencyService.convertCurrency(
            loan.amount, 
            fromCurrency, 
            toCurrency
          );

          await updateLoan(loan.id, {
            ...loan,
            amount: convertedAmount,
            currency: toCurrency
          });

          task.itemsProcessed++;
          await this.saveQueue();
        }
      } catch (error) {
        console.error(`Error converting loan ${loan.id}:`, error);
      }
    }
  }

  private async convertInvestments(
    investments: any[], 
    fromCurrency: string, 
    toCurrency: string, 
    task: ConversionTask
  ) {
    for (const investment of investments) {
      try {
        if (investment.currency === fromCurrency) {
          const convertedInitial = await currencyService.convertCurrency(
            investment.initial_amount, 
            fromCurrency, 
            toCurrency
          );

          const convertedCurrent = investment.current_value ? 
            await currencyService.convertCurrency(investment.current_value, fromCurrency, toCurrency) : 
            convertedInitial;

          await updateInvestment(investment.id, {
            ...investment,
            initial_amount: convertedInitial,
            current_value: convertedCurrent,
            currency: toCurrency
          });

          task.itemsProcessed++;
          await this.saveQueue();
        }
      } catch (error) {
        console.error(`Error converting investment ${investment.id}:`, error);
      }
    }
  }

  // Process the offline queue when network is restored
  public async processQueue(): Promise<void> {
    if (this.queue.isProcessing || !this.isOnline) {
      return;
    }

    const pendingTasks = this.queue.tasks.filter(task => task.status === 'pending');
    
    for (const task of pendingTasks) {
      console.log(`Processing queued currency conversion: ${task.fromCurrency} → ${task.toCurrency}`);
      await this.performCurrencyConversion(task.fromCurrency, task.toCurrency);
    }
  }

  public getQueueStatus(): ConversionQueue {
    return { ...this.queue };
  }

  public async clearCompletedTasks(): Promise<void> {
    this.queue.tasks = this.queue.tasks.filter(task => 
      task.status === 'pending' || task.status === 'processing'
    );
    await this.saveQueue();
  }

  public destroy(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
  }
}

export const currencyConversionManager = CurrencyConversionManager.getInstance();
export default currencyConversionManager;
