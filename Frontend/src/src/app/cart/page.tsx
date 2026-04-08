import CartPageClient, { CartTab } from './CartPageClient';

export default function CartPage({
    searchParams,
}: {
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const tabParam = searchParams?.tab;
    const tabValue = Array.isArray(tabParam) ? tabParam[0] : tabParam;
    const activeTab: CartTab = tabValue === 'favorites' ? 'favorites' : 'cart';

    return <CartPageClient activeTab={activeTab} />;
}
