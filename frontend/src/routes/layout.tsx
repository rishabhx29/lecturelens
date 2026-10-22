import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { signOut, fetchUserAttributes } from "aws-amplify/auth";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";

const Layout: React.FC = () => {
  const { pathname } = useLocation();
  const [userInfo, setUserInfo] = useState<{
    attributes: Awaited<ReturnType<typeof fetchUserAttributes>>;
  } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    (async () => {
      try {
        const attributes = await fetchUserAttributes();
        setUserInfo({ attributes });
      } catch (error) {
        console.error("Failed to load user attributes", error);
      }
    })();
  }, []);

  const handleSignOutClick = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    await signOut();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation
        userInfo={userInfo}
        handleSignOutClick={handleSignOutClick}
      />
      <main className="site-container w-full flex-1 py-7 sm:py-9">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
