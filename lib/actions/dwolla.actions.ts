"use server";

import { Client } from "dwolla-v2";

// ==================
// TYPE DEFINITIONS
// ==================
interface CreateFundingSourceOptions {
  customerId: string;
  fundingSourceName: string;
  plaidToken: string;
  _links?: any;
}

interface NewDwollaCustomerParams {
  firstName: string;
  lastName: string;
  email: string;
  type: 'personal' | 'business';
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateOfBirth?: string;
  ssn?: string;
}

interface TransferParams {
  sourceFundingSourceUrl: string;
  destinationFundingSourceUrl: string;
  amount: string;
}

interface AddFundingSourceParams {
  dwollaCustomerId: string;
  processorToken: string;
  bankName: string;
}

interface OnDemandAuthorizationResponse {
  _links: {
    self: { href: string };
    resource: { href: string };
  };
}

// ==========================
// ENVIRONMENT + CLIENT SETUP
// ==========================
const getEnvironment = (): "production" | "sandbox" => {
  const env = process.env.DWOLLA_ENV;
  if (!env || (env !== "sandbox" && env !== "production")) {
    return "sandbox";
  }
  return env;
};

const validateDwollaConfig = (): void => {
  if (!process.env.DWOLLA_KEY || !process.env.DWOLLA_SECRET) {
    throw new Error("Missing DWOLLA_KEY or DWOLLA_SECRET in env");
  }
};

const dwollaClient = new Client({
  environment: getEnvironment(),
  key: (process.env.DWOLLA_KEY || "") as string,
  secret: (process.env.DWOLLA_SECRET || "") as string,
});

// ===================================
// FUNDING SOURCE: GET EXISTING
// ===================================
const getCustomerFundingSources = async (customerId: string): Promise<any[]> => {
  try {
    const res = await dwollaClient.get(`customers/${customerId}/funding-sources`);
    return res.body._embedded?.['funding-sources'] || [];
  } catch (err) {
    console.error("Failed to fetch existing funding sources:", err);
    return [];
  }
};

// ===================================
// FUNDING SOURCE: CREATE
// ===================================
export const createFundingSource = async (
  options: CreateFundingSourceOptions
): Promise<string> => {
  validateDwollaConfig();
  const { customerId, plaidToken, fundingSourceName, _links } = options;

  if (!customerId || !plaidToken || !fundingSourceName) {
    throw new Error("Missing required parameters for funding source creation");
  }

  // Prevent duplicate bank linking
  const existingSources = await getCustomerFundingSources(customerId);
  const alreadyLinked = existingSources.find(
    (src) => src.name?.toLowerCase() === fundingSourceName.toLowerCase()
  );
  if (alreadyLinked) {
    console.warn("Bank already linked. Returning existing funding source.");
    return alreadyLinked._links.self.href;
  }

  const payload: any = {
    name: fundingSourceName,
    plaidToken,
    ...( _links && { _links })
  };

  const response = await dwollaClient.post(
    `customers/${customerId}/funding-sources`,
    payload
  );

  const fundingSourceUrl = response.headers.get("location");
  if (!fundingSourceUrl) {
    throw new Error("Failed to get funding source location from response headers");
  }

  return fundingSourceUrl;
};

// ===================================
// FUNDING SOURCE: ADD
// ===================================
export const addFundingSource = async ({
  dwollaCustomerId,
  processorToken,
  bankName,
}: AddFundingSourceParams): Promise<{ fundingSourceUrl: string; shareableId: string }> => {
  validateDwollaConfig();

  if (!dwollaCustomerId || !processorToken || !bankName) {
    throw new Error("Missing required parameters for adding funding source");
  }

  const dwollaAuthLinks = await createOnDemandAuthorization();

  const fundingSourceOptions: CreateFundingSourceOptions = {
    customerId: dwollaCustomerId,
    fundingSourceName: bankName,
    plaidToken: processorToken,
    _links: dwollaAuthLinks._links,
  };

  const fundingSourceUrl = await createFundingSource(fundingSourceOptions);
  const shareableId = fundingSourceUrl.split("/").pop();

  if (!shareableId) {
    throw new Error("Failed to extract shareableId from funding source URL");
  }

  return { fundingSourceUrl, shareableId };
};

// ===================================
// ON-DEMAND AUTHORIZATION
// ===================================
export const createOnDemandAuthorization = async (): Promise<OnDemandAuthorizationResponse> => {
  validateDwollaConfig();

  const response = await dwollaClient.post("on-demand-authorizations");

  if (!response.body?._links) {
    throw new Error("Invalid response from Dwolla On Demand Authorization");
  }

  return response.body;
};

// ===================================
// CUSTOMER: CREATE
// ===================================
export const createDwollaCustomer = async (
  newCustomer: NewDwollaCustomerParams
): Promise<string> => {
  validateDwollaConfig();

  const { firstName, lastName, email, type } = newCustomer;
  if (!firstName || !lastName || !email || !type) {
    throw new Error("Missing required customer information");
  }

  const response = await dwollaClient.post("customers", newCustomer);
  const customerUrl = response.headers.get("location");

  if (!customerUrl) {
    throw new Error("Failed to get customer location from response headers");
  }

  return customerUrl;
};

// ===================================
// TRANSFER: CREATE
// ===================================
export const createTransfer = async ({
  sourceFundingSourceUrl,
  destinationFundingSourceUrl,
  amount,
}: TransferParams): Promise<string> => {
  validateDwollaConfig();

  if (!sourceFundingSourceUrl || !destinationFundingSourceUrl || !amount) {
    throw new Error('Invalid transfer parameters - missing values.');
  }

  console.log('Attempting transfer with:', {
    sourceFundingSourceUrl,
    destinationFundingSourceUrl,
    amount
  });

  try {
    const requestBody = {
      _links: {
        source: { href: encodeURI(sourceFundingSourceUrl) },
        destination: { href: encodeURI(destinationFundingSourceUrl) },
      },
      amount: {
        currency: "USD",
        value: amount,
      },
    };

    const response = await dwollaClient.post("transfers", requestBody);

    const transferUrl = response.headers.get("location");

    if (!transferUrl) {
      throw new Error("Failed to get transfer location from response headers");
    }

    return transferUrl;
  } catch (error) {
    console.error('Detailed Dwolla transfer error:', error);
    throw error;
  }
};
