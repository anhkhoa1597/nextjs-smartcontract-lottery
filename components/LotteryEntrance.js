import { contractAddresses, abi } from "../constants"
// dont export from moralis when using react
import { useMoralis, useWeb3Contract } from "react-moralis"
import { useEffect, useState } from "react"
import { useNotification } from "web3uikit"
import { ethers } from "ethers"
import { formatEther } from "ethers/lib/utils"
import styles from "../styles/Home.module.css"

export default function LotteryEntrance() {
    const { Moralis, isWeb3Enabled, chainId: chainIdHex } = useMoralis()
    // // These get re-rendered every time due to our connect button!
    const chainId = parseInt(chainIdHex)
    console.log(`ChainId is ${chainId}`)
    const raffleAddress = chainId in contractAddresses ? contractAddresses[chainId][0] : null
    // const chainIds = Object.keys(contractAddresses)
    console.log(`raffleAddress is ${raffleAddress}`)

    // // State hooks
    const [entranceFee, setEntranceFee] = useState("0")
    const [numberOfPlayers, setNumberOfPlayers] = useState("0")
    const [recentWinner, setRecentWinner] = useState("0")
    const [countdown, setCountdown] = useState()
    const [chainIdstate, setchainIdstate] = useState("0")
    const [raffleState, setRaffleState] = useState(0)

    const dispatch = useNotification()

    const {
        runContractFunction: enterRaffle,
        data: enterTxResponse,
        isLoading,
        isFetching,
    } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress,
        functionName: "enterRaffle",
        msgValue: entranceFee,
        params: {},
    })

    /* View Functions */
    const { runContractFunction: getInterval } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress,
        functionName: "getInterval",
        params: {},
    })

    const { runContractFunction: getLastestTimeStamp } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress,
        functionName: "getLastestTimeStamp",
        params: {},
    })

    const { runContractFunction: getRaffleState } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress,
        functionName: "getRaffleState",
        params: {},
    })

    const { runContractFunction: getEntranceFee } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress, // specify the networkId
        functionName: "getEntranceFee",
        params: {},
    })

    const { runContractFunction: getPlayersNumber } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress,
        functionName: "getNumberOfPlayers",
        params: {},
    })

    const { runContractFunction: getRecentWinner } = useWeb3Contract({
        abi: abi,
        contractAddress: raffleAddress,
        functionName: "getRecentWinner",
        params: {},
    })

    async function updateUIValues() {
        const entranceFeeFromCall = await getEntranceFee()
        const numPlayersFromCall = await getPlayersNumber()
        const recentWinnerFromCall = await getRecentWinner()
        const lastTimeStampFromCall = await getLastestTimeStamp()
        const intervalFromCall = await getInterval()
        const raffleStateFromCall = await getRaffleState()

        const currentTime = Math.floor(Date.now() / 1000)
        const timeElapsed = currentTime - lastTimeStampFromCall
        const timeRemaining = intervalFromCall - timeElapsed
        console.log("recentWinnerFromCall: ", recentWinnerFromCall)

        setEntranceFee(entranceFeeFromCall.toString())
        setNumberOfPlayers(numPlayersFromCall.toString())
        setRecentWinner(recentWinnerFromCall)
        setchainIdstate(chainId.toString())
        setRaffleState(raffleStateFromCall)
        setCountdown(Math.max(timeRemaining, 0))
    }

    // xử lý thời gian
    const updateCountdown = async () => {
        try {
            const lastTimeStamp = Number((await getLastestTimeStamp()).toString())
            const interval = Number((await getInterval()).toString())
            const currentTime = Math.floor(Date.now() / 1000)
            const timeRemaining = interval + lastTimeStamp - currentTime

            setCountdown(Math.max(timeRemaining, 0))
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        let intervalId

        if (isWeb3Enabled && raffleAddress) {
            updateUIValues()
            updateCountdown() // Gọi lần đầu để thiết lập đếm ngược

            intervalId = setInterval(() => {
                updateCountdown()
            }, 1000)
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [isWeb3Enabled, raffleAddress, getLastestTimeStamp, getInterval])

    useEffect(() => {
        if (isWeb3Enabled && raffleAddress) {
            updateUIValues()

            const provider = new ethers.providers.Web3Provider(window.ethereum)
            const raffleContract = new ethers.Contract(raffleAddress, abi, provider)

            // Định nghĩa các hàm lắng nghe sự kiện ở đây
            const onRaffleEnter = (player) => {
                console.log(`Player Entered: ${player}`)
                // Cập nhật UI hoặc trạng thái ở đây
                updateCountdown()
                updateUIValues()
            }

            const onRequestedRaffleWinner = (requestId) => {
                console.log(`Raffle Winner Requested: ${requestId}`)
                // Cập nhật UI hoặc trạng thái ở đây
                updateUIValues()
            }

            const onWinnerPicked = (winner) => {
                console.log(`Winner Picked: ${winner}`)
                // Cập nhật UI hoặc trạng thái ở đây
                updateUIValues()

                dispatch({
                    type: "success",
                    message: `Người chiến thắng mới đã được chọn: ${winner}`,
                    title: "Người Chiến Thắng!",
                    position: "topR",
                    icon: "trophy",
                })
            }

            // Đăng ký lắng nghe sự kiện
            raffleContract.on("RaffleEnter", onRaffleEnter)
            raffleContract.on("RequestedRaffleWinner", onRequestedRaffleWinner)
            raffleContract.on("WinnerPicked", onWinnerPicked)

            // Xử lý dọn dẹp khi component unmount
            return () => {
                raffleContract.off("RaffleEnter", onRaffleEnter)
                raffleContract.off("RequestedRaffleWinner", onRequestedRaffleWinner)
                raffleContract.off("WinnerPicked", onWinnerPicked)
            }
        }
    }, [isWeb3Enabled, raffleAddress]) // Thêm raffleAddress vào dependency array

    const handleNewNotification = () => {
        dispatch({
            type: "info",
            message: "Transaction Complete!",
            title: "Transaction Notification",
            position: "topR",
            icon: "bell",
        })
    }

    const handleSuccess = async (tx) => {
        try {
            await tx.wait(1)
            handleNewNotification(tx)
            updateUIValues()
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <div className="p-5 my-2 rounded-xl bg-gray-100">
            <div className="max-w-xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-5">
                <h1 className="text-3xl font-bold text-center text-blue-600 mb-4">Lottery</h1>
                {raffleAddress ? (
                    <>
                        {!raffleState ? (
                            <div className="text-center space-y-4">
                                {parseInt(numberOfPlayers) >= 1 ? (
                                    <p className="text-xl font-semibold text-gray-700">
                                        Time remaining:{" "}
                                        <span className="text-green-500">{countdown}</span> seconds
                                    </p>
                                ) : (
                                    <p className="text-xl font-semibold text-gray-700">Welcome!</p>
                                )}
                                <button
                                    className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded transition-all ease-in-out duration-300
                                        ${
                                            isLoading || isFetching
                                                ? "opacity-50 cursor-not-allowed"
                                                : ""
                                        }`}
                                    onClick={async () =>
                                        await enterRaffle({
                                            onSuccess: handleSuccess,
                                            onError: (error) => console.log(error),
                                        })
                                    }
                                    disabled={isLoading || isFetching}
                                >
                                    {isLoading || isFetching ? (
                                        <div className="animate-spin spinner-border h-8 w-8 border-b-2 rounded-full"></div>
                                    ) : (
                                        "Enter Raffle"
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`${styles.blinkingText} text-xl font-semibold text-center text-gray-700`}
                            >
                                Calculating...
                            </div>
                        )}
                        <div className="mt-6 text-center text-gray-700 space-y-2">
                            <p>
                                Entrance Fee:{" "}
                                <span className="text-blue-500">{formatEther(entranceFee)}</span>{" "}
                                ETH
                            </p>
                            <p>
                                Current ChainId:{" "}
                                <span className="text-blue-500">{chainIdstate}</span>
                            </p>
                            <p>
                                The current number of players is:{" "}
                                <span className="text-blue-500">{numberOfPlayers}</span>
                            </p>
                            <p>
                                The most previous winner was:{" "}
                                <span className="text-blue-500">{recentWinner}</span>
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-xl font-semibold text-gray-700">
                        Please connect to a supported chain
                    </div>
                )}
            </div>
        </div>
    )
}
