export const Well = ({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className: string;
}>) => {
  return (
    <div className={`w-full bg-white rounded-md shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
};
